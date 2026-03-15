import type { ZodType } from "zod";
import type {
  AssistantMessageType,
  SkillName,
  WorkflowStep
} from "@empirical/shared";

export type SkillExecutionContext = {
  projectId: string;
  currentStep: WorkflowStep;
  projectTitle: string;
  promptVersion: string;
};

export type SkillDefinition<I, O> = {
  name: SkillName;
  promptKey: SkillName;
  allowedSteps: WorkflowStep[];
  messageType: AssistantMessageType;
  inputSchema: ZodType<I>;
  outputSchema: ZodType<O>;
  fallback: (input: I, context: SkillExecutionContext) => O;
};

export type SkillRunResult<T> = {
  success: boolean;
  skillName: SkillName;
  messageType: AssistantMessageType;
  data: T;
  error: { type: string; message: string } | null;
  fallbackUsed: boolean;
  runId: string;
};
