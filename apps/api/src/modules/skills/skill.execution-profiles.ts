import { SkillName } from "@empirical/shared";
import type { LlmProfileName } from "../llm/llm.service";

export type SkillExecutionProfile = {
  llmProfile: LlmProfileName;
  inferenceMessageLimit: number;
  promptMessageLimit: number;
  includeResearchProfileInPrompt: boolean;
  timeoutMs: number;
};

const defaultProfile: SkillExecutionProfile = {
  llmProfile: "fast",
  inferenceMessageLimit: 0,
  promptMessageLimit: 0,
  includeResearchProfileInPrompt: false,
  timeoutMs: 15_000
};

export const skillExecutionProfiles: Record<SkillName, SkillExecutionProfile> = {
  [SkillName.TOPIC_DETECT]: defaultProfile,
  [SkillName.TOPIC_NORMALIZE]: defaultProfile,
  [SkillName.SOP_GUIDE]: defaultProfile,
  [SkillName.DATA_CLEANING]: {
    llmProfile: "code",
    inferenceMessageLimit: 0,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false,
    timeoutMs: 20_000
  },
  [SkillName.DATA_CHECK]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false,
    timeoutMs: 20_000
  },
  [SkillName.BASELINE_REGRESSION]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false,
    timeoutMs: 20_000
  },
  [SkillName.ROBUSTNESS]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false,
    timeoutMs: 20_000
  },
  [SkillName.MECHANISM]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false,
    timeoutMs: 20_000
  },
  [SkillName.HETEROGENEITY]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false,
    timeoutMs: 20_000
  },
  [SkillName.IV]: {
    llmProfile: "code",
    inferenceMessageLimit: 6,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false,
    timeoutMs: 20_000
  },
  [SkillName.WORKFLOW_INPUT_INTERPRETER]: {
    llmProfile: "fast",
    inferenceMessageLimit: 6,
    promptMessageLimit: 6,
    includeResearchProfileInPrompt: true,
    timeoutMs: 15_000
  },
  [SkillName.GENERAL_RESEARCH_CHAT]: {
    llmProfile: "fast",
    inferenceMessageLimit: 6,
    promptMessageLimit: 6,
    includeResearchProfileInPrompt: true,
    timeoutMs: 15_000
  },
  [SkillName.RESULT_INTERPRET]: {
    llmProfile: "fast",
    inferenceMessageLimit: 0,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false,
    timeoutMs: 15_000
  },
  [SkillName.STATA_ERROR_DEBUG]: {
    llmProfile: "code",
    inferenceMessageLimit: 0,
    promptMessageLimit: 0,
    includeResearchProfileInPrompt: false,
    timeoutMs: 20_000
  },
  [SkillName.EXPORT_TABLE]: defaultProfile
};
