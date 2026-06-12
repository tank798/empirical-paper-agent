import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { type SkillName, type WorkflowProgressPayload, type WorkflowStep } from "@empirical/shared";
import { PrismaService } from "../prisma/prisma.service";

type RecentMessageLike = {
  role: string;
  messageType: string;
  step: string | null;
  contentText?: string | null;
  contentJson?: Record<string, unknown>;
};

type AgentRunStatus = "running" | "succeeded" | "failed" | "cancelled";
type PermissionDecision = "allow" | "approve" | "deny";

const RUNNING_STATUSES = new Set<AgentRunStatus>(["running"]);
const DEFAULT_CONTEXT_BUDGET = 6000;
const DEFAULT_TOOL_OUTPUT_BUDGET = 12000;
const DEFAULT_ARTIFACT_PREVIEW = 1800;

function trimText(value: string, maxLength: number) {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 3))}...`;
}

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "{}";
  }
}

function jsonSize(value: unknown) {
  return safeStringify(value).length;
}

function hasPathEscape(value: unknown) {
  if (typeof value === "string") {
    return /(^|[\\/])\.\.([\\/]|$)|^~|^[a-zA-Z]:[\\/](?:Windows|Users|private|System)|\/etc\/|\/var\/|\/private\//.test(value);
  }

  if (Array.isArray(value)) {
    return value.some(hasPathEscape);
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some(hasPathEscape);
  }

  return false;
}

@Injectable()
export class HarnessService {
  constructor(private readonly prisma: PrismaService) {}

  async createRun(input: {
    projectId: string;
    kind: string;
    requestedStep?: WorkflowStep | null;
    currentStep?: WorkflowStep | null;
    userMessage?: string;
    inputJson?: Record<string, unknown>;
  }) {
    const run = await this.prisma.agentRun.create({
      data: {
        projectId: input.projectId,
        kind: input.kind,
        status: "running",
        requestedStep: input.requestedStep ?? null,
        currentStep: input.currentStep ?? input.requestedStep ?? null,
        phase: "thinking",
        userMessagePreview: input.userMessage ? trimText(input.userMessage, 260) : null,
        progressPercent: 2,
        currentCount: 0,
        totalCount: 0,
        inputJson: (input.inputJson ?? {}) as never,
        startedAt: new Date(),
        lastHeartbeatAt: new Date()
      }
    });

    await this.recordEvent({
      projectId: input.projectId,
      runId: run.id,
      type: "run_started",
      phase: "thinking",
      message: "Agent run started",
      metadata: {
        kind: input.kind,
        requestedStep: input.requestedStep ?? null
      }
    });

    return this.mapRun(run);
  }

  async heartbeat(runId: string, message?: string) {
    const run = await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        lastHeartbeatAt: new Date(),
        phase: "thinking"
      }
    });

    await this.recordEvent({
      projectId: run.projectId,
      runId,
      type: "heartbeat",
      phase: "thinking",
      message: message ?? "Run heartbeat"
    });
  }

  async updateRunProgress(runId: string, progress: WorkflowProgressPayload) {
    const percent = Math.max(
      1,
      Math.min(99, Math.round((progress.currentCount / Math.max(1, progress.totalCount)) * 100))
    );
    const run = await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        phase: "running",
        progressPercent: percent,
        currentCount: progress.currentCount,
        totalCount: progress.totalCount,
        stageLabel: progress.stageLabel,
        lastHeartbeatAt: new Date()
      }
    });

    await this.recordEvent({
      projectId: run.projectId,
      runId,
      type: "progress",
      phase: "running",
      message: `${progress.stageLabel} ${percent}%`,
      progress,
      metadata: { percent }
    });

    return this.mapRun(run);
  }

  async completeRun(runId: string, outputJson: Record<string, unknown> = {}) {
    const run = await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "succeeded",
        phase: "complete",
        progressPercent: 100,
        outputJson: outputJson as never,
        completedAt: new Date(),
        lastHeartbeatAt: new Date()
      }
    });

    await this.recordEvent({
      projectId: run.projectId,
      runId,
      type: "run_completed",
      phase: "complete",
      message: "Agent run completed",
      metadata: { status: "succeeded" }
    });

    return this.mapRun(run);
  }

  async failRun(runId: string, error: unknown) {
    const errorJson = {
      type: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error)
    };
    const run = await this.prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "failed",
        phase: "error",
        errorJson: errorJson as never,
        completedAt: new Date(),
        lastHeartbeatAt: new Date()
      }
    });

    await this.recordEvent({
      projectId: run.projectId,
      runId,
      type: "run_failed",
      phase: "error",
      message: errorJson.message,
      metadata: errorJson
    });

    return this.mapRun(run);
  }

  async getRun(projectId: string, runId: string) {
    const run = await this.prisma.agentRun.findFirst({
      where: { id: runId, projectId },
      include: {
        events: {
          orderBy: { createdAt: "desc" },
          take: 20
        },
        toolResults: {
          orderBy: { createdAt: "desc" },
          take: 20
        },
        artifacts: {
          orderBy: { createdAt: "desc" },
          take: 20
        }
      }
    });

    if (!run) {
      throw new BadRequestException("Agent run not found");
    }

    return {
      ...this.mapRun(run),
      events: run.events.reverse().map((event) => ({
        id: event.id,
        type: event.type,
        phase: event.phase,
        message: event.message,
        progress: event.progressJson,
        metadata: event.metadataJson,
        createdAt: event.createdAt.toISOString()
      })),
      toolResults: run.toolResults.reverse().map((result) => ({
        id: result.id,
        toolName: result.toolName,
        step: result.step,
        status: result.status,
        permissionDecision: result.permissionDecision,
        durationMs: result.durationMs,
        createdAt: result.createdAt.toISOString()
      })),
      artifacts: run.artifacts.reverse().map((artifact) => ({
        id: artifact.id,
        kind: artifact.kind,
        name: artifact.name,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        preview: artifact.contentPreview,
        metadata: artifact.metadataJson,
        createdAt: artifact.createdAt.toISOString()
      }))
    };
  }

  async getLatestActiveRun(projectId: string) {
    const run = await this.prisma.agentRun.findFirst({
      where: {
        projectId,
        status: {
          in: Array.from(RUNNING_STATUSES)
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return run ? this.mapRun(run) : null;
  }

  async recordEvent(input: {
    projectId: string;
    runId?: string | null;
    type: string;
    phase?: string | null;
    message?: string | null;
    progress?: WorkflowProgressPayload | null;
    metadata?: Record<string, unknown>;
  }) {
    return this.prisma.agentEvent.create({
      data: {
        projectId: input.projectId,
        runId: input.runId ?? null,
        type: input.type,
        phase: input.phase ?? null,
        message: input.message ?? null,
        progressJson: (input.progress ?? null) as never,
        metadataJson: (input.metadata ?? {}) as never
      }
    });
  }

  authorizeTool(toolName: string, input: unknown): { decision: PermissionDecision; reason: string } {
    if (/delete|remove|drop|destroy|credential|secret/i.test(toolName)) {
      return { decision: "deny", reason: "Destructive or secret-related tool calls are not allowed." };
    }

    if (hasPathEscape(input)) {
      return { decision: "deny", reason: "Tool input contains a path outside the allowed workspace boundary." };
    }

    if (/write_export_file|run_stata|execute_shell|deploy|external_post/i.test(toolName)) {
      return { decision: "approve", reason: "This tool has external or local side effects and requires approval." };
    }

    return { decision: "allow", reason: "Read-only or internal structured skill call." };
  }

  async recordToolResult(input: {
    projectId: string;
    runId?: string | null;
    toolUseId?: string | null;
    toolName: SkillName | string;
    step?: WorkflowStep | null;
    status: "success" | "fallback" | "error" | "denied" | "needs_approval";
    permissionDecision: PermissionDecision;
    inputJson?: Record<string, unknown>;
    outputJson?: Record<string, unknown> | null;
    errorJson?: Record<string, unknown> | null;
    durationMs?: number | null;
  }) {
    const result = await this.prisma.agentToolResult.create({
      data: {
        projectId: input.projectId,
        runId: input.runId ?? null,
        toolUseId: input.toolUseId ?? null,
        toolName: String(input.toolName),
        step: input.step ?? null,
        status: input.status,
        permissionDecision: input.permissionDecision,
        inputJson: (this.budgetJson(input.inputJson ?? {}, DEFAULT_TOOL_OUTPUT_BUDGET) as Record<string, unknown>) as never,
        outputJson: input.outputJson
          ? (this.budgetJson(input.outputJson, DEFAULT_TOOL_OUTPUT_BUDGET) as Record<string, unknown>) as never
          : undefined,
        errorJson: input.errorJson ? (input.errorJson as never) : undefined,
        durationMs: input.durationMs ?? null
      }
    });

    await this.recordEvent({
      projectId: input.projectId,
      runId: input.runId,
      type: "tool_result",
      phase: input.status === "error" || input.status === "denied" ? "error" : "running",
      message: `${input.toolName}: ${input.status}`,
      metadata: {
        toolResultId: result.id,
        permissionDecision: input.permissionDecision,
        durationMs: input.durationMs ?? null
      }
    });

    return result;
  }

  async createTextArtifact(input: {
    projectId: string;
    runId?: string | null;
    kind: string;
    name: string;
    contentText: string;
    mimeType?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    const preview = trimText(input.contentText, DEFAULT_ARTIFACT_PREVIEW);
    const artifact = await this.prisma.agentArtifact.create({
      data: {
        projectId: input.projectId,
        runId: input.runId ?? null,
        kind: input.kind,
        name: input.name,
        mimeType: input.mimeType ?? "text/plain",
        sizeBytes: Buffer.byteLength(input.contentText, "utf8"),
        contentPreview: preview,
        contentText: input.contentText,
        metadataJson: (input.metadata ?? {}) as never
      }
    });

    await this.recordEvent({
      projectId: input.projectId,
      runId: input.runId,
      type: "artifact_created",
      phase: "running",
      message: `${input.kind}: ${input.name}`,
      metadata: {
        artifactId: artifact.id,
        sizeBytes: artifact.sizeBytes
      }
    });

    return {
      id: artifact.id,
      preview,
      reference: `artifact:${artifact.id}`
    };
  }

  async budgetUserMessage(input: {
    projectId: string;
    runId?: string | null;
    userMessage: string;
    maxLength?: number;
  }) {
    const maxLength = input.maxLength ?? 8000;
    if (input.userMessage.length <= maxLength) {
      return {
        userMessage: input.userMessage,
        artifactIds: [] as string[]
      };
    }

    const artifact = await this.createTextArtifact({
      projectId: input.projectId,
      runId: input.runId,
      kind: "user_message_full_text",
      name: "用户输入全文",
      contentText: input.userMessage,
      metadata: {
        originalLength: input.userMessage.length,
        budgetedLength: maxLength
      }
    });

    return {
      userMessage: [
        trimText(input.userMessage, maxLength),
        "",
        `[完整内容已保存为 ${artifact.reference}，上方为预算内预览。]`
      ].join("\n"),
      artifactIds: [artifact.id]
    };
  }

  buildSkillContext(input: {
    recentMessages: RecentMessageLike[];
    messageBudget?: number;
    profileBudget?: number;
  }) {
    const perMessageBudget = input.messageBudget ?? 280;
    return input.recentMessages.map((message) => ({
      role: message.role,
      messageType: message.messageType,
      step: message.step,
      content: trimText(
        message.contentText?.trim() || safeStringify(message.contentJson ?? {}),
        perMessageBudget
      )
    }));
  }

  budgetJson(value: Record<string, unknown>, maxLength: number): Record<string, unknown> {
    if (jsonSize(value) <= maxLength) {
      return value;
    }

    return {
      preview: trimText(safeStringify(value), maxLength),
      truncated: true,
      originalLength: jsonSize(value)
    };
  }

  buildProfileDiff(before: Record<string, unknown> | null, after: Record<string, unknown>) {
    const diffs: Array<{ field: string; before: unknown; after: unknown }> = [];
    const beforeData = before ?? {};
    const keys = new Set([...Object.keys(beforeData), ...Object.keys(after)]);

    for (const key of keys) {
      const oldValue = beforeData[key];
      const newValue = after[key];
      if (safeStringify(oldValue ?? null) !== safeStringify(newValue ?? null)) {
        diffs.push({
          field: key,
          before: oldValue ?? null,
          after: newValue ?? null
        });
      }
    }

    return diffs;
  }

  assertAllowed(toolName: string, input: unknown) {
    const permission = this.authorizeTool(toolName, input);
    if (permission.decision === "deny" || permission.decision === "approve") {
      throw new ForbiddenException(permission.reason);
    }

    return permission;
  }

  private mapRun(run: {
    id: string;
    projectId: string;
    kind: string;
    status: string;
    requestedStep: string | null;
    currentStep: string | null;
    phase: string | null;
    userMessagePreview: string | null;
    progressPercent: number;
    currentCount: number;
    totalCount: number;
    stageLabel: string | null;
    inputJson: unknown;
    outputJson: unknown;
    errorJson: unknown;
    startedAt: Date | null;
    completedAt: Date | null;
    lastHeartbeatAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: run.id,
      projectId: run.projectId,
      kind: run.kind,
      status: run.status as AgentRunStatus,
      requestedStep: run.requestedStep as WorkflowStep | null,
      currentStep: run.currentStep as WorkflowStep | null,
      phase: run.phase,
      userMessagePreview: run.userMessagePreview,
      progressPercent: run.progressPercent,
      currentCount: run.currentCount,
      totalCount: run.totalCount,
      stageLabel: run.stageLabel,
      input: run.inputJson,
      output: run.outputJson,
      error: run.errorJson,
      startedAt: run.startedAt?.toISOString() ?? null,
      completedAt: run.completedAt?.toISOString() ?? null,
      lastHeartbeatAt: run.lastHeartbeatAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString()
    };
  }
}
