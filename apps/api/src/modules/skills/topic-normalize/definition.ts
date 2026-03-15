import { AssistantMessageType, SkillName, WorkflowStep, topicNormalizeInputSchema, topicNormalizeOutputSchema } from "@empirical/shared";
import { normalizeTopic } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const topicNormalizeSkill: SkillDefinition<any, any> = {
  name: SkillName.TOPIC_NORMALIZE,
  promptKey: SkillName.TOPIC_NORMALIZE,
  allowedSteps: [WorkflowStep.TOPIC_DETECT, WorkflowStep.TOPIC_NORMALIZE],
  messageType: AssistantMessageType.TOPIC_CONFIRM,
  inputSchema: topicNormalizeInputSchema,
  outputSchema: topicNormalizeOutputSchema,
  fallback: (input) => normalizeTopic(input.rawTopic)
};
