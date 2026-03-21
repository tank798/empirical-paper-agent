import {
  AssistantMessageType,
  MAIN_WORKFLOW_STEPS,
  SkillName,
  generalResearchChatInputSchema,
  generalResearchChatOutputSchema
} from "@empirical/shared";
import { buildGeneralResearchChatFallback } from "../workflow-output.builder";
import type { SkillDefinition } from "../skill.types";

export const generalResearchChatSkill: SkillDefinition<any, any> = {
  name: SkillName.GENERAL_RESEARCH_CHAT,
  promptKey: SkillName.GENERAL_RESEARCH_CHAT,
  allowedSteps: MAIN_WORKFLOW_STEPS,
  messageType: AssistantMessageType.RESEARCH_CHAT,
  inputSchema: generalResearchChatInputSchema,
  outputSchema: generalResearchChatOutputSchema,
  fallback: (input) => buildGeneralResearchChatFallback(input)
};
