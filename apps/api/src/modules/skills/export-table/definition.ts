import { AssistantMessageType, SkillName, WorkflowStep, placeholderSkillOutputSchema, regressionSkillInputSchema } from "@empirical/shared";
import { buildPlaceholderSkillOutput } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const exportTableSkill: SkillDefinition<any, any> = {
  name: SkillName.EXPORT_TABLE,
  promptKey: SkillName.EXPORT_TABLE,
  allowedSteps: [WorkflowStep.BASELINE_REGRESSION, WorkflowStep.EXPORT_TABLE],
  messageType: AssistantMessageType.SYSTEM_NOTICE,
  inputSchema: regressionSkillInputSchema,
  outputSchema: placeholderSkillOutputSchema,
  fallback: () => buildPlaceholderSkillOutput(SkillName.EXPORT_TABLE)
};
