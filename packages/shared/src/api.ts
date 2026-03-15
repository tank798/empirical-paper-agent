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
