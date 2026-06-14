import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { HarnessService } from "../harness/harness.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  MAX_RETRIEVED_CHUNKS,
  SOURCE_CHUNK_OVERLAP,
  SOURCE_CHUNK_SIZE,
  SOURCE_FULL_TEXT_LIMIT,
  type InputSourceType,
  type NormalizedInputSource,
  type PreparedInputSource,
  compactPreparedSourceForMetadata,
  formatSourceIndexEntry,
  normalizeSourceText,
  prepareInputSource,
  selectRelevantChunks,
  sourceTypeFromMime,
  trimHeadTail
} from "./input-source.utils";

type PreparedTurnSource = PreparedInputSource & {
  artifactId: string;
  reference: string;
};

type RawInputSourcePayload = Record<string, unknown> & {
  sourceId?: string;
  sourceType?: string;
  fileName?: string;
  name?: string;
  mimeType?: string;
  size?: number;
  text?: string;
  content?: string;
  truncated?: boolean;
  source?: string;
  metadata?: Record<string, unknown>;
};

type SourceArtifactMetadata = {
  sourceId?: string;
  sourceType?: string;
  fileName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  textLength?: number;
  truncated?: boolean;
  mode?: string;
  relevance?: {
    level?: string;
    score?: number;
    matchedKeywords?: string[];
    checkedLength?: number;
  };
  preview?: string;
  selectedChunks?: Array<Record<string, unknown>>;
};

@Injectable()
export class InputSourceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly harnessService: HarnessService
  ) {}

  async prepareTurnContext(input: {
    projectId: string;
    runId?: string | null;
    userMessage: string;
    payload: Record<string, unknown>;
  }) {
    const normalizedSources = this.normalizeSources(input.userMessage, input.payload);
    const preparedSources: PreparedTurnSource[] = [];

    for (const source of normalizedSources) {
      const normalizedText = normalizeSourceText(source.text);
      if (!normalizedText) {
        continue;
      }

      const prepared = prepareInputSource({ ...source, text: normalizedText });
      const artifact = await this.harnessService.createTextArtifact({
        projectId: input.projectId,
        runId: input.runId ?? null,
        kind: "input_source",
        name: source.fileName ?? source.sourceId,
        mimeType: source.mimeType ?? "text/plain",
        contentText: normalizedText,
        metadata: compactPreparedSourceForMetadata(prepared)
      });
      preparedSources.push({
        ...prepared,
        artifactId: artifact.id,
        reference: artifact.reference
      });
    }

    const compactPayload = this.compactPayloadForAgent(input.payload);
    const userMessageForModel = this.buildUserMessageForModel(input.userMessage, preparedSources);
    const sourceContextText = this.formatTurnSources(preparedSources);

    return {
      userMessageForModel,
      userMessageForStorage: userMessageForModel,
      sourceContextText,
      compactPayload,
      sourceArtifactIds: preparedSources.map((source) => source.artifactId),
      sourceSummaries: preparedSources.map((source) => ({
        sourceId: source.sourceId,
        artifactId: source.artifactId,
        sourceType: source.sourceType,
        fileName: source.fileName ?? null,
        textLength: source.textLength,
        mode: source.mode,
        relevanceLevel: source.relevance.level,
        matchedKeywords: source.matchedKeywords.slice(0, 20)
      }))
    };
  }

  async buildProjectSourceIndex(projectId: string) {
    const artifacts = await this.prisma.agentArtifact.findMany({
      where: { projectId, kind: "input_source" },
      orderBy: { createdAt: "desc" },
      take: 30
    });

    if (artifacts.length === 0) {
      return "";
    }

    return artifacts
      .reverse()
      .map((artifact) => {
        const metadata = this.readSourceMetadata(artifact.metadataJson);
        return formatSourceIndexEntry({
          sourceId: metadata.sourceId ?? `artifact:${artifact.id}`,
          artifactId: artifact.id,
          sourceType: metadata.sourceType ?? "unknown",
          fileName: metadata.fileName ?? artifact.name,
          textLength: metadata.textLength ?? artifact.contentText?.length ?? artifact.sizeBytes ?? 0,
          mode: metadata.mode ?? null,
          relevanceLevel: metadata.relevance?.level ?? null,
          matchedKeywords: metadata.relevance?.matchedKeywords ?? [],
          createdAt: artifact.createdAt
        });
      })
      .join("\n");
  }

  async recallSources(input: {
    projectId: string;
    sourceIds?: unknown;
    query?: unknown;
    maxChunks?: unknown;
  }) {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    const maxChunks = clampNumber(Number(input.maxChunks), 1, MAX_RETRIEVED_CHUNKS, 8);
    const requestedSourceIds = Array.isArray(input.sourceIds)
      ? input.sourceIds.map((item) => String(item).trim()).filter(Boolean)
      : [];

    const artifacts = await this.prisma.agentArtifact.findMany({
      where: { projectId: input.projectId, kind: "input_source" },
      orderBy: { createdAt: "desc" },
      take: 50
    });

    const matchedArtifacts = requestedSourceIds.length > 0
      ? artifacts.filter((artifact) => {
          const metadata = this.readSourceMetadata(artifact.metadataJson);
          return requestedSourceIds.includes(artifact.id) || requestedSourceIds.includes(metadata.sourceId ?? "");
        })
      : artifacts.slice(0, 8);

    if (matchedArtifacts.length === 0) {
      return {
        ok: false,
        error: requestedSourceIds.length > 0
          ? "没有找到匹配的历史输入源。请检查 sourceId，或先查看历史输入源索引。"
          : "当前项目还没有可回看的历史输入源。"
      };
    }

    const recalledSources = matchedArtifacts.reverse().map((artifact) => {
      const metadata = this.readSourceMetadata(artifact.metadataJson);
      const contentText = normalizeSourceText(artifact.contentText ?? "");
      const sourceType = metadata.sourceType ?? "unknown";
      const sourceId = metadata.sourceId ?? `artifact:${artifact.id}`;
      const base = {
        sourceId,
        artifactId: artifact.id,
        sourceType,
        fileName: metadata.fileName ?? artifact.name,
        textLength: metadata.textLength ?? contentText.length,
        originalMode: metadata.mode ?? "unknown",
        relevanceLevel: metadata.relevance?.level ?? "unknown"
      };

      if (!contentText) {
        return {
          ...base,
          mode: "empty",
          content: ""
        };
      }

      if (sourceType === "spreadsheet") {
        return {
          ...base,
          mode: "spreadsheet_summary",
          content: contentText.length > 12000 ? trimHeadTail(contentText, 12000, 6000, 6000) : contentText
        };
      }

      if (!query && contentText.length <= 12000) {
        return {
          ...base,
          mode: "full_text",
          content: contentText
        };
      }

      const chunks = selectRelevantChunks(contentText, {
        query,
        maxChunks,
        chunkSize: SOURCE_CHUNK_SIZE,
        overlap: SOURCE_CHUNK_OVERLAP
      });

      return {
        ...base,
        mode: chunks.length > 0 ? "recalled_chunks" : "preview_fallback",
        query,
        chunks: chunks.map((chunk) => ({
          chunkId: chunk.chunkId,
          index: chunk.index,
          start: chunk.start,
          end: chunk.end,
          score: chunk.score,
          matchedKeywords: chunk.matchedKeywords,
          text: chunk.text
        })),
        content: chunks.length > 0 ? undefined : trimHeadTail(contentText, 4000, 2000, 2000)
      };
    });

    return {
      ok: true,
      query,
      maxChunks,
      sources: recalledSources,
      note: "这些内容是历史输入源回看结果，只能作为上下文材料；是否更新研究设定或回答问题仍需继续判断。"
    };
  }

  compactPayloadForAgent(payload: Record<string, unknown>) {
    const compact: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key === "inputSources") {
        continue;
      }
      if (key === "attachment" && value && typeof value === "object") {
        const attachment = value as Record<string, unknown>;
        compact.attachment = {
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
          truncated: attachment.truncated
        };
        continue;
      }
      compact[key] = value;
    }
    return compact;
  }

  private normalizeSources(userMessage: string, payload: Record<string, unknown>) {
    const payloadSources = Array.isArray(payload.inputSources)
      ? (payload.inputSources as RawInputSourcePayload[])
      : [];

    if (payloadSources.length > 0) {
      return payloadSources.flatMap((source, index) => this.normalizePayloadSource(source, index));
    }

    const legacy = this.extractLegacyAttachmentSources(userMessage);
    if (legacy.length > 0) {
      return legacy;
    }

    const text = normalizeSourceText(userMessage);
    if (!text) {
      return [];
    }

    return [
      {
        sourceId: this.makeSourceId("user_text", "用户输入", text, 0),
        sourceType: "user_text" as const,
        text
      }
    ];
  }

  private normalizePayloadSource(source: RawInputSourcePayload, index: number): NormalizedInputSource[] {
    const text = normalizeSourceText(String(source.text ?? source.content ?? ""));
    if (!text) {
      return [];
    }

    const fileName = stringOrUndefined(source.fileName ?? source.name);
    const mimeType = stringOrUndefined(source.mimeType);
    const sourceType = sourceTypeFromMime({
      sourceType: source.sourceType,
      mimeType,
      fileName,
      source: source.source
    });

    return [
      {
        sourceId: source.sourceId ?? this.makeSourceId(sourceType, fileName ?? "source", text, index),
        sourceType,
        fileName,
        mimeType,
        size: typeof source.size === "number" ? source.size : undefined,
        text,
        truncated: Boolean(source.truncated),
        metadata: source.metadata
      }
    ];
  }

  private extractLegacyAttachmentSources(userMessage: string): NormalizedInputSource[] {
    const marker = "[附件内容]";
    const markerIndex = userMessage.indexOf(marker);
    if (markerIndex < 0) {
      return [];
    }

    const baseText = normalizeSourceText(userMessage.slice(0, markerIndex));
    const attachmentBlock = normalizeSourceText(userMessage.slice(markerIndex + marker.length));
    const sources: NormalizedInputSource[] = [];

    if (baseText) {
      sources.push({
        sourceId: this.makeSourceId("user_text", "用户输入", baseText, 0),
        sourceType: "user_text",
        text: baseText
      });
    }

    if (attachmentBlock) {
      const fileNameMatch = attachmentBlock.match(/^文件名：(.+)$/m);
      const mimeTypeMatch = attachmentBlock.match(/^类型：(.+)$/m);
      const fileName = fileNameMatch?.[1]?.trim();
      const mimeType = mimeTypeMatch?.[1]?.trim();
      sources.push({
        sourceId: this.makeSourceId("document", fileName ?? "legacy_attachment", attachmentBlock, 1),
        sourceType: sourceTypeFromMime({ fileName, mimeType }),
        fileName,
        mimeType,
        text: attachmentBlock,
        metadata: { legacyAttachment: true }
      });
    }

    return sources;
  }

  private buildUserMessageForModel(userMessage: string, sources: PreparedTurnSource[]) {
    const normalized = normalizeSourceText(userMessage);
    if (!normalized) {
      return sources.length > 0 ? "请结合本轮输入源继续处理用户需求。" : "";
    }

    const hasLongSource = sources.some((source) => source.textLength > SOURCE_FULL_TEXT_LIMIT);
    if (hasLongSource || normalized.length > 4000) {
      return trimHeadTail(normalized, 3000, 1500, 1500);
    }

    return normalized;
  }

  private formatTurnSources(sources: PreparedTurnSource[]) {
    if (sources.length === 0) {
      return "";
    }

    const blocks = sources.map((source) => [
      source.contextText,
      `保存引用：artifact:${source.artifactId}`
    ].join("\n"));

    return [
      "# 本轮输入源",
      "说明：每个 source 均独立处理；附件、表格和用户粘贴文本不会互相混合。",
      "说明：长文本片段是本地预处理召回结果，不代表最终研究设定；需要由 Agent 自行判断是否调用工具更新状态。",
      ...blocks
    ].join("\n\n");
  }

  private readSourceMetadata(value: unknown): SourceArtifactMetadata {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as SourceArtifactMetadata;
  }

  private makeSourceId(sourceType: InputSourceType, name: string, text: string, index: number) {
    const hash = createHash("sha1")
      .update(sourceType)
      .update(name)
      .update(String(index))
      .update(String(text.length))
      .update(text.slice(0, 512))
      .digest("hex")
      .slice(0, 8);
    return `source_${index + 1}_${hash}`;
  }
}

function stringOrUndefined(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || undefined;
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.floor(value)));
}
