import type {
  AssistantMessageEnvelope,
  ProjectDetail,
  ProjectExportState,
  ResearchProfile
} from "./schemas";

export type ApiError = {
  type: string;
  message: string;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> =
  | {
      success: true;
      data: T;
      error: null;
    }
  | {
      success: false;
      data: null;
      error: ApiError;
    };

export type WorkflowNextResponse = {
  projectId: string;
  currentStep: string;
  assistantMessage: AssistantMessageEnvelope;
  runId?: string | null;
};

export const WorkflowStreamPhase = {
  THINKING: "thinking",
  TYPING: "typing",
  COMPLETE: "complete"
} as const;

export type WorkflowStreamPhase =
  (typeof WorkflowStreamPhase)[keyof typeof WorkflowStreamPhase];

export type WorkflowProgressPayload = {
  currentCount: number;
  totalCount: number;
  stageLabel: string;
  remainingMinutes: number;
  percent?: number;
};

export type AgentRunSummary = {
  id: string;
  projectId: string;
  kind: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  requestedStep: string | null;
  currentStep: string | null;
  phase: string | null;
  userMessagePreview: string | null;
  progressPercent: number;
  currentCount: number;
  totalCount: number;
  stageLabel: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowStreamEvent =
  | {
      type: "run";
      run: AgentRunSummary;
    }
  | {
      type: "status";
      runId?: string | null;
      phase: WorkflowStreamPhase;
      message: string;
    }
  | {
      type: "progress";
      runId?: string | null;
      progress: WorkflowProgressPayload;
    }
  | {
      type: "message";
      runId?: string | null;
      response: WorkflowNextResponse;
    }
  | {
      type: "error";
      runId?: string | null;
      message: string;
    }
  | {
      type: "done";
    };

export type ProjectSummaryForClient = Pick<
  ProjectDetail["project"],
  "id" | "title" | "topicRaw" | "topicNormalized" | "currentStep" | "updatedAt"
>;

export type ProjectClientBundle = {
  detail: ProjectDetail;
  recentMessages: AssistantMessageEnvelope[];
  researchProfile: ResearchProfile | null;
  exportState: ProjectExportState | null;
};
