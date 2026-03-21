import {
  AssistantMessageType,
  SkillName,
  WorkflowStep,
  stataErrorDebugInputSchema,
  stataErrorDebugOutputSchema
} from "@empirical/shared";
import { buildStataErrorFallback } from "../workflow-output.builder";
import type { SkillDefinition } from "../skill.types";

export const stataErrorDebugSkill: SkillDefinition<any, any> = {
  name: SkillName.STATA_ERROR_DEBUG,
  promptKey: SkillName.STATA_ERROR_DEBUG,
  allowedSteps: [WorkflowStep.DATA_CLEANING, WorkflowStep.DATA_CHECK, WorkflowStep.BASELINE_REGRESSION],
  messageType: AssistantMessageType.STATA_ERROR_FIX,
  inputSchema: stataErrorDebugInputSchema,
  outputSchema: stataErrorDebugOutputSchema,
  fallback: (input) => buildStataErrorFallback(input)
};
