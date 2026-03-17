import { SkillName } from "@empirical/shared";
import type { LlmProfileName } from "../llm/llm.service";

export type SkillExecutionProfile = {
  llmProfile: LlmProfileName;
  inferenceMessageLimit: number;
  promptMessageLimit: number;
  includeResearchProfileInPrompt: boolean;
};

const defaultProfile: SkillExecutionProfile = {
  llmProfile: "fast",
  inferenceMessageLimit: 0,
  promptMessageLimit: 0,
  includeResearchProfileInPrompt: false
};

export const skillExecutionProfiles: Record<SkillName, SkillExecutionProfile> = {
  [SkillName.TOPIC_DETECT]: defaultProfile,
  [SkillName.TOPIC_NORMALIZE]: defaultProfile,
  [SkillName.SOP_GUIDE]: defaultProfile,
  [SkillName.DATA_CLEANING]: {
    llmProfile: "code",
    inferenceMessageLimit: 0,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false
  },
  [SkillName.DATA_CHECK]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false
  },
  [SkillName.BASELINE_REGRESSION]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false
  },
  [SkillName.ROBUSTNESS]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false
  },
  [SkillName.MECHANISM]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false
  },
  [SkillName.HETEROGENEITY]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false
  },
  [SkillName.IV]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false
  },
  [SkillName.WORKFLOW_INPUT_INTERPRETER]: {
    llmProfile: "fast",
    inferenceMessageLimit: 6,
    promptMessageLimit: 6,
    includeResearchProfileInPrompt: true
  },
  [SkillName.GENERAL_RESEARCH_CHAT]: {
    llmProfile: "fast",
    inferenceMessageLimit: 6,
    promptMessageLimit: 6,
    includeResearchProfileInPrompt: true
  },
  [SkillName.RESULT_INTERPRET]: {
    llmProfile: "fast",
    inferenceMessageLimit: 0,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false
  },
  [SkillName.STATA_ERROR_DEBUG]: {
    llmProfile: "code",
    inferenceMessageLimit: 0,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false
  },
  [SkillName.EXPORT_TABLE]: defaultProfile
};
