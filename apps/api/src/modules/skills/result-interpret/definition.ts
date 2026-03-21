import {
  AssistantMessageType,
  SkillName,
  WorkflowStep,
  resultInterpretInputSchema,
  resultInterpretOutputSchema
} from "@empirical/shared";
import { buildResultInterpretFallback } from "../workflow-output.builder";
import type { SkillDefinition } from "../skill.types";

export const resultInterpretSkill: SkillDefinition<any, any> = {
  name: SkillName.RESULT_INTERPRET,
  promptKey: SkillName.RESULT_INTERPRET,
  allowedSteps: [WorkflowStep.DATA_CLEANING, WorkflowStep.DATA_CHECK, WorkflowStep.BASELINE_REGRESSION],
  messageType: AssistantMessageType.RESULT_INTERPRET,
  inputSchema: resultInterpretInputSchema,
  outputSchema: resultInterpretOutputSchema,
  fallback: (input) => buildResultInterpretFallback(input)
};
