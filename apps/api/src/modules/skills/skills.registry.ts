import { SkillName } from "@empirical/shared";
import { baselineRegressionSkill } from "./baseline-regression/definition";
import { dataCheckSkill } from "./data-check/definition";
import { dataCleaningSkill } from "./data-cleaning/definition";
import { exportTableSkill } from "./export-table/definition";
import { generalResearchChatSkill } from "./general-research-chat/definition";
import { workflowInputInterpreterSkill } from "./workflow-input-interpreter/definition";
import { heterogeneitySkill } from "./heterogeneity/definition";
import { ivSkill } from "./iv/definition";
import { mechanismSkill } from "./mechanism/definition";
import { resultInterpretSkill } from "./result-interpret/definition";
import { robustnessSkill } from "./robustness/definition";
import { sopGuideSkill } from "./sop-guide/definition";
import { stataErrorDebugSkill } from "./stata-error-debug/definition";
import { topicDetectSkill } from "./topic-detect/definition";
import { topicNormalizeSkill } from "./topic-normalize/definition";

export const skillRegistry = {
  [SkillName.TOPIC_DETECT]: topicDetectSkill,
  [SkillName.TOPIC_NORMALIZE]: topicNormalizeSkill,
  [SkillName.SOP_GUIDE]: sopGuideSkill,
  [SkillName.DATA_CLEANING]: dataCleaningSkill,
  [SkillName.DATA_CHECK]: dataCheckSkill,
  [SkillName.BASELINE_REGRESSION]: baselineRegressionSkill,
  [SkillName.ROBUSTNESS]: robustnessSkill,
  [SkillName.MECHANISM]: mechanismSkill,
  [SkillName.HETEROGENEITY]: heterogeneitySkill,
  [SkillName.IV]: ivSkill,
  [SkillName.WORKFLOW_INPUT_INTERPRETER]: workflowInputInterpreterSkill,
  [SkillName.GENERAL_RESEARCH_CHAT]: generalResearchChatSkill,
  [SkillName.RESULT_INTERPRET]: resultInterpretSkill,
  [SkillName.STATA_ERROR_DEBUG]: stataErrorDebugSkill,
  [SkillName.EXPORT_TABLE]: exportTableSkill
} as const;
