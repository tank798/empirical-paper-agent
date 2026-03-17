import {
  AssistantMessageType,
  MAIN_WORKFLOW_STEPS,
  SkillName,
  workflowInputInterpreterInputSchema,
  workflowInputInterpreterOutputSchema
} from "@empirical/shared";
import { buildWorkflowInputInterpreterOutput } from "../skill.utils";
import type { SkillDefinition } from "../skill.types";

export const workflowInputInterpreterSkill: SkillDefinition<any, any> = {
  name: SkillName.WORKFLOW_INPUT_INTERPRETER,
  promptKey: SkillName.WORKFLOW_INPUT_INTERPRETER,
  allowedSteps: MAIN_WORKFLOW_STEPS,
  messageType: AssistantMessageType.SYSTEM_NOTICE,
  inputSchema: workflowInputInterpreterInputSchema,
  outputSchema: workflowInputInterpreterOutputSchema,
  fallback: (input) => buildWorkflowInputInterpreterOutput(input)
};
