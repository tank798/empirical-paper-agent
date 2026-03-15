import { AssistantMessageType, SkillName, WorkflowStep, dataCheckInputSchema, dataCheckOutputSchema } from "@empirical/shared";
import { buildDataCheckOutput } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const dataCheckSkill: SkillDefinition<any, any> = {
  name: SkillName.DATA_CHECK,
  promptKey: SkillName.DATA_CHECK,
  allowedSteps: [WorkflowStep.DATA_CLEANING, WorkflowStep.DATA_CHECK],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: dataCheckInputSchema,
  outputSchema: dataCheckOutputSchema,
  fallback: (input) => buildDataCheckOutput(input)
};
