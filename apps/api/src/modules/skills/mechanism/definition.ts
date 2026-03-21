import { AssistantMessageType, SkillName, WorkflowStep, regressionSkillInputSchema, regressionSkillOutputSchema } from "@empirical/shared";
import { buildRegressionModuleOutput } from "../workflow-output.builder";
import type { SkillDefinition } from "../skill.types";

export const mechanismSkill: SkillDefinition<any, any> = {
  name: SkillName.MECHANISM,
  promptKey: SkillName.MECHANISM,
  allowedSteps: [WorkflowStep.BASELINE_REGRESSION, WorkflowStep.MECHANISM],
  messageType: AssistantMessageType.SKILL_OUTPUT,
  inputSchema: regressionSkillInputSchema,
  outputSchema: regressionSkillOutputSchema,
  fallback: (input) => buildRegressionModuleOutput(SkillName.MECHANISM, input, "机制分析", "mechanism")
};
