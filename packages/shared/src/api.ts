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
};

export type WorkflowStreamEvent =
  | {
      type: "status";
      phase: WorkflowStreamPhase;
      message: string;
    }
  | {
      type: "progress";
      progress: WorkflowProgressPayload;
    }
  | {
      type: "message";
      response: WorkflowNextResponse;
    }
  | {
      type: "error";
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