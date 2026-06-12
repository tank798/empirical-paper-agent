import {
  AssistantMessageType,
  SkillName,
  WorkflowStep,
  researchSetupInterpreterInputSchema,
  researchSetupInterpreterOutputSchema
} from "@empirical/shared";
import { buildResearchSetupInterpreterOutput } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const researchSetupInterpreterSkill: SkillDefinition<any, any> = {
  name: SkillName.RESEARCH_SETUP_INTERPRETER,
  promptKey: SkillName.RESEARCH_SETUP_INTERPRETER,
  allowedSteps: [WorkflowStep.TOPIC_DETECT, WorkflowStep.TOPIC_NORMALIZE],
  messageType: AssistantMessageType.SYSTEM_NOTICE,
  inputSchema: researchSetupInterpreterInputSchema,
  outputSchema: researchSetupInterpreterOutputSchema,
  fallback: (input) => buildResearchSetupInterpreterOutput(input)
};
