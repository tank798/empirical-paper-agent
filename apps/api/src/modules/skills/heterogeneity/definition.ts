import { AssistantMessageType, SkillName, WorkflowStep, regressionSkillInputSchema, regressionSkillOutputSchema } from "@empirical/shared";
import { buildRegressionModuleOutput } from "../workflow-output.builder";
import type { SkillDefinition } from "../skill.types";

export const heterogeneitySkill: SkillDefinition<any, any> = {
  name: SkillName.HETEROGENEITY,
  promptKey: SkillName.HETEROGENEITY,
  allowedSteps: [WorkflowStep.BASELINE_REGRESSION, WorkflowStep.HETEROGENEITY],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: regressionSkillInputSchema,
  outputSchema: regressionSkillOutputSchema,
  fallback: (input) => buildRegressionModuleOutput(SkillName.HETEROGENEITY, input, "异质性分析", "heterogeneity")
};
