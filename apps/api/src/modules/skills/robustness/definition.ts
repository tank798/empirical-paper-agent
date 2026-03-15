import { AssistantMessageType, SkillName, WorkflowStep, placeholderSkillOutputSchema, regressionSkillInputSchema } from "@empirical/shared";
import { buildPlaceholderSkillOutput } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const robustnessSkill: SkillDefinition<any, any> = {
  name: SkillName.ROBUSTNESS,
  promptKey: SkillName.ROBUSTNESS,
  allowedSteps: [WorkflowStep.BASELINE_REGRESSION, WorkflowStep.ROBUSTNESS],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: regressionSkillInputSchema,
  outputSchema: placeholderSkillOutputSchema,
  fallback: () => buildPlaceholderSkillOutput(SkillName.ROBUSTNESS)
};
