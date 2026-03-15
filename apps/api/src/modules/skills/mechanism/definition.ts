import { AssistantMessageType, SkillName, WorkflowStep, placeholderSkillOutputSchema, regressionSkillInputSchema } from "@empirical/shared";
import { buildPlaceholderSkillOutput } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const mechanismSkill: SkillDefinition<any, any> = {
  name: SkillName.MECHANISM,
  promptKey: SkillName.MECHANISM,
  allowedSteps: [WorkflowStep.BASELINE_REGRESSION, WorkflowStep.MECHANISM],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: regressionSkillInputSchema,
  outputSchema: placeholderSkillOutputSchema,
  fallback: () => buildPlaceholderSkillOutput(SkillName.MECHANISM)
};
