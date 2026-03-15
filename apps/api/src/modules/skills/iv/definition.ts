import { AssistantMessageType, SkillName, WorkflowStep, placeholderSkillOutputSchema, regressionSkillInputSchema } from "@empirical/shared";
import { buildPlaceholderSkillOutput } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const ivSkill: SkillDefinition<any, any> = {
  name: SkillName.IV,
  promptKey: SkillName.IV,
  allowedSteps: [WorkflowStep.BASELINE_REGRESSION, WorkflowStep.IV],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: regressionSkillInputSchema,
  outputSchema: placeholderSkillOutputSchema,
  fallback: () => buildPlaceholderSkillOutput(SkillName.IV)
};
