import { AssistantMessageType, SkillName, WorkflowStep, regressionSkillInputSchema, regressionSkillOutputSchema } from "@empirical/shared";
import { buildRegressionOutput } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const baselineRegressionSkill: SkillDefinition<any, any> = {
  name: SkillName.BASELINE_REGRESSION,
  promptKey: SkillName.BASELINE_REGRESSION,
  allowedSteps: [WorkflowStep.DATA_CHECK, WorkflowStep.BASELINE_REGRESSION],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: regressionSkillInputSchema,
  outputSchema: regressionSkillOutputSchema,
  fallback: (input) => buildRegressionOutput(SkillName.BASELINE_REGRESSION, input, "»ù×¼»Ø¹é")
};
