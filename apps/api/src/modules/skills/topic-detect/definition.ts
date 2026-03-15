import { AssistantMessageType, SkillName, WorkflowStep, topicDetectInputSchema, topicDetectOutputSchema } from "@empirical/shared";
import { detectTopic } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const topicDetectSkill: SkillDefinition<any, any> = {
  name: SkillName.TOPIC_DETECT,
  promptKey: SkillName.TOPIC_DETECT,
  allowedSteps: [WorkflowStep.TOPIC_DETECT, WorkflowStep.TOPIC_NORMALIZE],
  messageType: AssistantMessageType.SYSTEM_NOTICE,
  inputSchema: topicDetectInputSchema,
  outputSchema: topicDetectOutputSchema,
  fallback: (input) => detectTopic(input.userInput)
};
