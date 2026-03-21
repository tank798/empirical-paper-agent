import {
  AssistantMessageType,
  SkillName,
  WorkflowStep,
  topicNormalizeInputSchema,
  topicNormalizeOutputSchema
} from "@empirical/shared";
import { buildTopicNormalizeOutputTemplate } from "../workflow-output.builder";
import type { SkillDefinition } from "../skill.types";

export const topicNormalizeSkill: SkillDefinition<any, any> = {
  name: SkillName.TOPIC_NORMALIZE,
  promptKey: SkillName.TOPIC_NORMALIZE,
  allowedSteps: [WorkflowStep.TOPIC_DETECT, WorkflowStep.TOPIC_NORMALIZE],
  messageType: AssistantMessageType.TOPIC_CONFIRM,
  inputSchema: topicNormalizeInputSchema,
  outputSchema: topicNormalizeOutputSchema,
  fallback: (input) => buildTopicNormalizeOutputTemplate(input.rawTopic)
};
