import { AssistantMessageType, SkillName, WorkflowStep, regressionSkillInputSchema, regressionSkillOutputSchema } from "@empirical/shared";
import { buildRegressionModuleOutput } from "../workflow-output.builder";
import type { SkillDefinition } from "../skill.types";

export const robustnessSkill: SkillDefinition<any, any> = {
  name: SkillName.ROBUSTNESS,
  promptKey: SkillName.ROBUSTNESS,
  allowedSteps: [WorkflowStep.BASELINE_REGRESSION, WorkflowStep.ROBUSTNESS],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: regressionSkillInputSchema,
  outputSchema: regressionSkillOutputSchema,
  fallback: (input) => buildRegressionModuleOutput(SkillName.ROBUSTNESS, input, "稳健性检验", "robustness")
};
