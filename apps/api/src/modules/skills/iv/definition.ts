import { AssistantMessageType, SkillName, WorkflowStep, regressionSkillInputSchema, regressionSkillOutputSchema } from "@empirical/shared";
import { buildRegressionModuleOutput } from "../workflow-output.builder";
import type { SkillDefinition } from "../skill.types";

export const ivSkill: SkillDefinition<any, any> = {
  name: SkillName.IV,
  promptKey: SkillName.IV,
  allowedSteps: [WorkflowStep.BASELINE_REGRESSION, WorkflowStep.IV],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: regressionSkillInputSchema,
  outputSchema: regressionSkillOutputSchema,
  fallback: (input) => buildRegressionModuleOutput(SkillName.IV, input, "内生性分析", "iv")
};
