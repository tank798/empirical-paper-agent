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
    steps: [
      "1. 数据清洗：统一真实字段名，检查变量类型、缺失值、重复面板观测和极端值。",
      "2. 数据检查：做描述统计、相关性分析、年份覆盖和面板结构检查。",
      "3. 基准回归：以个体固定效应和年份固定效应作为主规格，按面板个体聚类。",
      "4. 稳健性检验：替换变量口径、调整样本区间，并按需要追加 DID 或 PSM 扩展。",
      "5. 机制分析：只有在用户提供机制变量时，才生成对应中介或调节检验。",
      "6. 异质性分析：只有在用户提供分组变量时，才生成分组或交互项检验。",
      "7. 内生性分析：只有在用户提供真实工具变量时，才生成可运行的 IV 代码；否则只保留工具变量选择标准。"
    ],
    recommendedStart: "数据清洗",
    message: `我已经确认研究设定“${input.normalizedTopic}”。后续会围绕${input.researchObject || "当前样本"}按面板固定效应主线生成可检查、可修改的 Stata 工作流。`
  })
};
