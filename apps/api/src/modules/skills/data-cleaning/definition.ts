import { AssistantMessageType, SkillName, WorkflowStep, dataCleaningInputSchema, dataCleaningOutputSchema } from "@empirical/shared";
import { buildDataCleaningOutput } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const dataCleaningSkill: SkillDefinition<any, any> = {
  name: SkillName.DATA_CLEANING,
  promptKey: SkillName.DATA_CLEANING,
  allowedSteps: [WorkflowStep.SOP_GUIDE, WorkflowStep.DATA_CLEANING],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: dataCleaningInputSchema,
  outputSchema: dataCleaningOutputSchema,
  fallback: (input) => buildDataCleaningOutput(input)
};
