export const SOURCE_FULL_TEXT_LIMIT = 30000;
export const PRECHECK_HEAD_LENGTH = 2000;
export const PRECHECK_TAIL_LENGTH = 1000;
export const PRECHECK_SCAN_LIMIT = 200000;
export const SOURCE_CHUNK_SIZE = 1500;
export const SOURCE_CHUNK_OVERLAP = 200;
export const MAX_RETRIEVED_CHUNKS = 20;
export const HISTORY_MESSAGE_LIMIT = 1000;

export type InputSourceType = "user_text" | "document" | "spreadsheet" | "image_ocr" | "attachment";
export type SourceHandlingMode = "full_text" | "selected_chunks" | "low_relevance_preview" | "spreadsheet";
export type RelevanceLevel = "high" | "medium" | "low";

export type NormalizedInputSource = {
  sourceId: string;
  sourceType: InputSourceType;
  fileName?: string;
  mimeType?: string;
  size?: number;
  text: string;
  truncated?: boolean;
  metadata?: Record<string, unknown>;
};

export type SourceScore = {
  score: number;
  matchedKeywords: string[];
  uniqueKeywordCount: number;
  headingBonus: number;
  densityBonus: number;
  structureBonus: number;
};

export type SourceChunk = {
  chunkId: string;
  index: number;
  start: number;
  end: number;
  text: string;
  score: number;
  matchedKeywords: string[];
};

export type SourceRelevance = {
  level: RelevanceLevel;
  score: number;
  matchedKeywords: string[];
  preview: string;
  checkedLength: number;
};

export type PreparedInputSource = {
  sourceId: string;
  sourceType: InputSourceType;
  fileName?: string;
  mimeType?: string;
  size?: number;
  textLength: number;
  truncated?: boolean;
  mode: SourceHandlingMode;
  relevance: SourceRelevance;
  preview: string;
  matchedKeywords: string[];
  selectedChunks: SourceChunk[];
  contextText: string;
  metadata?: Record<string, unknown>;
};

export const BASE_RESEARCH_KEYWORDS = [
  "研究",
  "论文",
  "实证",
  "经管",
  "变量",
  "指标",
  "模型",
  "样本",
  "数据",
  "回归",
  "假设",
  "机制",
  "异质性",
  "稳健性",
  "内生性",
  "固定效应",
  "控制变量",
  "解释变量",
  "被解释变量",
  "因变量",
  "自变量",
  "面板",
  "聚类",
  "Stata",
  "stata"
] as const;

export const HIGH_CONFIDENCE_RESEARCH_PHRASES = [
  "研究主题",
  "研究问题",
  "研究假设",
  "变量定义",
  "变量设定",
  "变量说明",
  "指标构建",
  "变量衡量",
  "样本区间",
  "样本选择",
  "数据来源",
  "模型设定",
  "计量模型",
  "实证模型",
  "回归模型",
  "基准回归",
  "双向固定效应",
  "聚类稳健标准误",
  "机制检验",
  "异质性分析",
  "稳健性检验",
  "内生性检验",
  "工具变量",
  "开题报告",
  "文献综述",
  "理论机制",
  "研究设计"
] as const;

const STRUCTURE_PATTERNS = [
  /表\s*\d+/,
  /变量名|字段名|变量含义|变量符号|定义|说明/,
  /Y\s*[iI]?[tT]?|X\s*[iI]?[tT]?|β|alpha|epsilon|回归方程/i,
  /(xtreg|reghdfe|regress|ivreg|psmatch2|esttab)/i
];

export function normalizeSourceText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

export function trimHeadTail(value: string, maxLength = HISTORY_MESSAGE_LIMIT, headLength = 500, tailLength = 500) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, headLength)}\n...[中间省略]...\n${trimmed.slice(-tailLength)}`;
}

export function buildSourcePreview(text: string, headLength = PRECHECK_HEAD_LENGTH, tailLength = PRECHECK_TAIL_LENGTH) {
  const normalized = normalizeSourceText(text);
  if (normalized.length <= headLength + tailLength) {
    return normalized;
  }

  return [
    normalized.slice(0, headLength),
    "",
    "[中间内容省略，仅用于快速预检]",
    "",
    normalized.slice(-tailLength)
  ].join("\n");
}

export function splitTextIntoChunks(
  text: string,
  chunkSize = SOURCE_CHUNK_SIZE,
  overlap = SOURCE_CHUNK_OVERLAP
) {
  const normalized = normalizeSourceText(text);
  if (!normalized) {
    return [] as SourceChunk[];
  }

  const chunks: SourceChunk[] = [];
  const step = Math.max(1, chunkSize - overlap);
  for (let start = 0, index = 0; start < normalized.length; start += step, index += 1) {
    const end = Math.min(normalized.length, start + chunkSize);
    const chunkText = normalized.slice(start, end).trim();
    if (chunkText) {
      chunks.push({
        chunkId: `chunk_${String(index + 1).padStart(3, "0")}`,
        index,
        start,
        end,
        text: chunkText,
        score: 0,
        matchedKeywords: []
      });
    }
    if (end >= normalized.length) {
      break;
    }
  }

  return chunks;
}

export function scoreResearchText(text: string, extraKeywords: string[] = []): SourceScore {
  const matched = new Set<string>();
  let score = 0;
  const lowerText = text.toLowerCase();

  for (const keyword of BASE_RESEARCH_KEYWORDS) {
    const count = countKeyword(lowerText, keyword.toLowerCase());
    if (count > 0) {
      matched.add(keyword);
      score += Math.min(3, count);
    }
  }

  for (const phrase of HIGH_CONFIDENCE_RESEARCH_PHRASES) {
    const count = countKeyword(lowerText, phrase.toLowerCase());
    if (count > 0) {
      matched.add(phrase);
      score += Math.min(2, count) * 4;
    }
  }

  for (const keyword of extraKeywords) {
    const normalized = keyword.trim();
    if (!normalized || normalized.length < 2) {
      continue;
    }
    const count = countKeyword(lowerText, normalized.toLowerCase());
    if (count > 0) {
      matched.add(normalized);
      score += Math.min(4, count) * 2;
    }
  }

  const headingText = text.slice(0, 220).toLowerCase();
  const headingHasPhrase = HIGH_CONFIDENCE_RESEARCH_PHRASES.some((phrase) =>
    headingText.includes(phrase.toLowerCase())
  );
  const headingHasBase = BASE_RESEARCH_KEYWORDS.some((keyword) => headingText.includes(keyword.toLowerCase()));
  const headingBonus = headingHasPhrase ? 10 : headingHasBase ? 6 : 0;
  score += headingBonus;

  const uniqueKeywordCount = matched.size;
  const densityBonus = uniqueKeywordCount >= 12 ? 6 : uniqueKeywordCount >= 7 ? 3 : uniqueKeywordCount >= 4 ? 1 : 0;
  score += densityBonus;

  const structureBonus = STRUCTURE_PATTERNS.some((pattern) => pattern.test(text)) ? 3 : 0;
  score += structureBonus;

  return {
    score,
    matchedKeywords: Array.from(matched),
    uniqueKeywordCount,
    headingBonus,
    densityBonus,
    structureBonus
  };
}

export function assessLongSourceRelevance(text: string): SourceRelevance {
  const normalized = normalizeSourceText(text);
  const preview = buildSourcePreview(normalized);
  const previewScore = scoreResearchText(preview);
  if (previewScore.score >= 12 || previewScore.uniqueKeywordCount >= 5) {
    return {
      level: "high",
      score: previewScore.score,
      matchedKeywords: previewScore.matchedKeywords,
      preview,
      checkedLength: preview.length
    };
  }

  const scanText = normalized.slice(0, PRECHECK_SCAN_LIMIT);
  const scanScore = scoreResearchText(scanText);
  if (scanScore.score >= 12 || scanScore.uniqueKeywordCount >= 5) {
    return {
      level: "medium",
      score: scanScore.score,
      matchedKeywords: scanScore.matchedKeywords,
      preview,
      checkedLength: scanText.length
    };
  }

  return {
    level: "low",
    score: Math.max(previewScore.score, scanScore.score),
    matchedKeywords: Array.from(new Set([...previewScore.matchedKeywords, ...scanScore.matchedKeywords])),
    preview,
    checkedLength: scanText.length
  };
}

export function selectRelevantChunks(
  text: string,
  options: {
    query?: string;
    maxChunks?: number;
    chunkSize?: number;
    overlap?: number;
  } = {}
) {
  const chunks = splitTextIntoChunks(
    text,
    options.chunkSize ?? SOURCE_CHUNK_SIZE,
    options.overlap ?? SOURCE_CHUNK_OVERLAP
  );
  const queryKeywords = tokenizeQuery(options.query ?? "");
  const scoredChunks = chunks
    .map((chunk) => {
      const score = scoreResearchText(chunk.text, queryKeywords);
      return {
        ...chunk,
        score: score.score,
        matchedKeywords: score.matchedKeywords
      };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const selected: SourceChunk[] = [];
  const seenChunkIds = new Set<string>();
  const seenBodies = new Set<string>();
  for (const chunk of scoredChunks) {
    const bodyKey = chunk.text.replace(/\s+/g, "").slice(0, 500);
    if (seenChunkIds.has(chunk.chunkId) || seenBodies.has(bodyKey)) {
      continue;
    }
    seenChunkIds.add(chunk.chunkId);
    seenBodies.add(bodyKey);
    selected.push(chunk);
    if (selected.length >= (options.maxChunks ?? MAX_RETRIEVED_CHUNKS)) {
      break;
    }
  }

  return selected.sort((a, b) => a.index - b.index);
}

export function prepareInputSource(source: NormalizedInputSource): PreparedInputSource {
  const text = normalizeSourceText(source.text);
  const isSpreadsheet = source.sourceType === "spreadsheet" || /spreadsheet|excel|sheet|csv/i.test(source.mimeType ?? "");
  const preview = buildSourcePreview(text);

  if (isSpreadsheet) {
    const relevance = assessSpreadsheetRelevance(text);
    return {
      sourceId: source.sourceId,
      sourceType: "spreadsheet",
      fileName: source.fileName,
      mimeType: source.mimeType,
      size: source.size,
      textLength: text.length,
      truncated: source.truncated,
      mode: "spreadsheet",
      relevance,
      preview,
      matchedKeywords: relevance.matchedKeywords,
      selectedChunks: [],
      contextText: formatSpreadsheetContext(source, text, relevance),
      metadata: source.metadata
    };
  }

  if (text.length <= SOURCE_FULL_TEXT_LIMIT) {
    const relevance = {
      level: "high" as const,
      ...scoreToRelevance(scoreResearchText(text), buildSourcePreview(text), text.length)
    };
    return {
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      fileName: source.fileName,
      mimeType: source.mimeType,
      size: source.size,
      textLength: text.length,
      truncated: source.truncated,
      mode: "full_text",
      relevance,
      preview,
      matchedKeywords: relevance.matchedKeywords,
      selectedChunks: [],
      contextText: formatFullTextContext(source, text),
      metadata: source.metadata
    };
  }

  const relevance = assessLongSourceRelevance(text);
  if (relevance.level === "low") {
    return {
      sourceId: source.sourceId,
      sourceType: source.sourceType,
      fileName: source.fileName,
      mimeType: source.mimeType,
      size: source.size,
      textLength: text.length,
      truncated: source.truncated,
      mode: "low_relevance_preview",
      relevance,
      preview,
      matchedKeywords: relevance.matchedKeywords,
      selectedChunks: [],
      contextText: formatLowRelevanceContext(source, relevance),
      metadata: source.metadata
    };
  }

  const selectedChunks = selectRelevantChunks(text, { maxChunks: MAX_RETRIEVED_CHUNKS });
  return {
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    fileName: source.fileName,
    mimeType: source.mimeType,
    size: source.size,
    textLength: text.length,
    truncated: source.truncated,
    mode: "selected_chunks",
    relevance,
    preview,
    matchedKeywords: relevance.matchedKeywords,
    selectedChunks,
    contextText: formatChunkContext(source, relevance, selectedChunks),
    metadata: source.metadata
  };
}

export function sourceTypeFromMime(input: {
  sourceType?: string;
  mimeType?: string;
  fileName?: string;
  source?: string;
}): InputSourceType {
  const declaredType = String(input.sourceType ?? "").trim();
  if (["user_text", "document", "spreadsheet", "image_ocr", "attachment"].includes(declaredType)) {
    return declaredType as InputSourceType;
  }

  const mimeType = String(input.mimeType ?? "").toLowerCase();
  const fileName = String(input.fileName ?? "").toLowerCase();
  const extension = fileName.split(".").pop() ?? "";

  if (mimeType.startsWith("image/") || input.source === "image") {
    return "image_ocr";
  }

  if (
    /spreadsheet|excel|csv/.test(mimeType) ||
    ["xls", "xlsx", "csv"].includes(extension)
  ) {
    return "spreadsheet";
  }

  if (fileName || /pdf|word|document|text|plain|markdown/.test(mimeType)) {
    return "document";
  }

  return "attachment";
}

export function compactPreparedSourceForMetadata(source: PreparedInputSource) {
  return {
    sourceId: source.sourceId,
    sourceType: source.sourceType,
    fileName: source.fileName ?? null,
    mimeType: source.mimeType ?? null,
    size: source.size ?? null,
    textLength: source.textLength,
    truncated: source.truncated ?? false,
    mode: source.mode,
    relevance: {
      level: source.relevance.level,
      score: source.relevance.score,
      matchedKeywords: source.relevance.matchedKeywords,
      checkedLength: source.relevance.checkedLength
    },
    preview: source.preview.slice(0, 1800),
    selectedChunks: source.selectedChunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      index: chunk.index,
      start: chunk.start,
      end: chunk.end,
      score: chunk.score,
      matchedKeywords: chunk.matchedKeywords
    }))
  };
}

export function formatSourceIndexEntry(input: {
  sourceId: string;
  artifactId: string;
  sourceType: string;
  fileName?: string | null;
  textLength?: number | null;
  mode?: string | null;
  relevanceLevel?: string | null;
  matchedKeywords?: string[];
  createdAt?: Date | string | null;
}) {
  const name = input.fileName || "用户文本";
  return [
    `- ${input.sourceId} (${input.artifactId})`,
    `  名称：${name}`,
    `  类型：${input.sourceType}`,
    `  长度：${input.textLength ?? 0} 字符`,
    `  处理：${input.mode ?? "unknown"}`,
    `  相关性：${input.relevanceLevel ?? "unknown"}`,
    input.matchedKeywords?.length ? `  命中：${input.matchedKeywords.slice(0, 12).join("、")}` : "",
    input.createdAt ? `  时间：${typeof input.createdAt === "string" ? input.createdAt : input.createdAt.toISOString()}` : ""
  ].filter(Boolean).join("\n");
}

function scoreToRelevance(score: SourceScore, preview: string, checkedLength: number) {
  return {
    score: score.score,
    matchedKeywords: score.matchedKeywords,
    preview,
    checkedLength
  };
}

function assessSpreadsheetRelevance(text: string): SourceRelevance {
  const preview = buildSourcePreview(text, 3000, 1000);
  const score = scoreResearchText(preview, ["工作表", "sheet", "变量名", "字段", "数据字典"]);
  return {
    level: score.score >= 8 || score.uniqueKeywordCount >= 3 ? "high" : "medium",
    score: score.score,
    matchedKeywords: score.matchedKeywords,
    preview,
    checkedLength: preview.length
  };
}

function formatSourceHeader(source: Pick<NormalizedInputSource, "sourceId" | "sourceType" | "fileName" | "mimeType" | "size">) {
  return [
    `[${source.sourceId}: ${source.fileName ?? source.sourceType}]`,
    `类型：${source.sourceType}`,
    source.mimeType ? `MIME：${source.mimeType}` : "",
    typeof source.size === "number" ? `大小：${source.size} bytes` : ""
  ].filter(Boolean).join("\n");
}

function formatFullTextContext(source: NormalizedInputSource, text: string) {
  return [
    formatSourceHeader(source),
    "处理：全文注入",
    "内容：",
    text
  ].join("\n");
}

function formatLowRelevanceContext(source: NormalizedInputSource, relevance: SourceRelevance) {
  return [
    formatSourceHeader(source),
    "处理：长文本低相关预检，仅注入前后预览；不要据此直接下结论，由 Agent 继续判断用户意图。",
    `相关性：${relevance.level}，分数：${relevance.score}`,
    relevance.matchedKeywords.length ? `命中：${relevance.matchedKeywords.join("、")}` : "命中：无明显经管实证关键词",
    "预览：",
    relevance.preview
  ].join("\n");
}

function formatChunkContext(source: NormalizedInputSource, relevance: SourceRelevance, chunks: SourceChunk[]) {
  const chunkTexts = chunks.map((chunk) => [
    `--- ${chunk.chunkId} | index=${chunk.index} | chars=${chunk.start}-${chunk.end} | score=${chunk.score} ---`,
    chunk.matchedKeywords.length ? `命中：${chunk.matchedKeywords.join("、")}` : "命中：无",
    chunk.text
  ].join("\n"));

  return [
    formatSourceHeader(source),
    `处理：长文本分块召回，chunk=${SOURCE_CHUNK_SIZE}，overlap=${SOURCE_CHUNK_OVERLAP}，最多${MAX_RETRIEVED_CHUNKS}段`,
    `相关性：${relevance.level}，预检分数：${relevance.score}`,
    relevance.matchedKeywords.length ? `预检命中：${relevance.matchedKeywords.join("、")}` : "",
    "说明：以下片段只是本地预处理召回结果，不是最终提取结论。",
    ...chunkTexts
  ].filter(Boolean).join("\n");
}

function formatSpreadsheetContext(source: NormalizedInputSource, text: string, relevance: SourceRelevance) {
  return [
    formatSourceHeader(source),
    "处理：表格结构化预览，按工作表/表头/样例行保留，避免和其他附件混合。",
    `相关性：${relevance.level}，分数：${relevance.score}`,
    "内容：",
    text.length > SOURCE_FULL_TEXT_LIMIT ? trimHeadTail(text, SOURCE_FULL_TEXT_LIMIT, 15000, 15000) : text
  ].join("\n");
}

function tokenizeQuery(query: string) {
  return Array.from(new Set(
    query
      .split(/[\s,，。；;、:：|/\\()[\]{}"'“”‘’]+/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2)
  ));
}

function countKeyword(lowerText: string, lowerKeyword: string) {
  if (!lowerKeyword) {
    return 0;
  }

  let count = 0;
  let start = 0;
  while (start < lowerText.length) {
    const foundAt = lowerText.indexOf(lowerKeyword, start);
    if (foundAt < 0) {
      break;
    }
    count += 1;
    start = foundAt + lowerKeyword.length;
  }
  return count;
}
