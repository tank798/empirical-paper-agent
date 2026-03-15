import { AssistantMessageType, SkillName, WorkflowStep, sopGuideInputSchema, sopGuideOutputSchema } from "@empirical/shared";
import type { SkillDefinition } from "../skill.types";

export const sopGuideSkill: SkillDefinition<any, any> = {
  name: SkillName.SOP_GUIDE,
  promptKey: SkillName.SOP_GUIDE,
  allowedSteps: [WorkflowStep.TOPIC_NORMALIZE, WorkflowStep.SOP_GUIDE],
  messageType: AssistantMessageType.SOP_GUIDE,
  inputSchema: sopGuideInputSchema,
  outputSchema: sopGuideOutputSchema,
  fallback: (input) => ({
    steps: ["数据清洗", "数据检查", "基准回归", "稳健性检验", "机制分析", "异质性分析", "内生性检验"],
    recommendedStart: "数据清洗",
    message: `好的，主题“${input.normalizedTopic}”已确认。接下来我会按标准经管实证流程一步一步带你完成。`
  })
};
