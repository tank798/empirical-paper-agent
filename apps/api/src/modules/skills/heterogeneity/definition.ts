import { AssistantMessageType, SkillName, WorkflowStep, placeholderSkillOutputSchema, regressionSkillInputSchema } from "@empirical/shared";
import { buildPlaceholderSkillOutput } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const heterogeneitySkill: SkillDefinition<any, any> = {
  name: SkillName.HETEROGENEITY,
  promptKey: SkillName.HETEROGENEITY,
  allowedSteps: [WorkflowStep.BASELINE_REGRESSION, WorkflowStep.HETEROGENEITY],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: regressionSkillInputSchema,
  outputSchema: placeholderSkillOutputSchema,
  fallback: () => buildPlaceholderSkillOutput(SkillName.HETEROGENEITY)
};
