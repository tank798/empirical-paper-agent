export const WorkflowStep = {
  TOPIC_DETECT: "TOPIC_DETECT",
  TOPIC_NORMALIZE: "TOPIC_NORMALIZE",
  SOP_GUIDE: "SOP_GUIDE",
  DATA_CLEANING: "DATA_CLEANING",
  DATA_CHECK: "DATA_CHECK",
  BASELINE_REGRESSION: "BASELINE_REGRESSION",
  ROBUSTNESS: "ROBUSTNESS",
  MECHANISM: "MECHANISM",
  HETEROGENEITY: "HETEROGENEITY",
  IV: "IV",
  EXPORT_TABLE: "EXPORT_TABLE"
} as const;

export type WorkflowStep = (typeof WorkflowStep)[keyof typeof WorkflowStep];

export const MAIN_WORKFLOW_STEPS: WorkflowStep[] = [
  WorkflowStep.TOPIC_DETECT,
  WorkflowStep.TOPIC_NORMALIZE,
  WorkflowStep.SOP_GUIDE,
  WorkflowStep.DATA_CLEANING,
  WorkflowStep.DATA_CHECK,
  WorkflowStep.BASELINE_REGRESSION,
  WorkflowStep.ROBUSTNESS,
  WorkflowStep.MECHANISM,
  WorkflowStep.HETEROGENEITY,
  WorkflowStep.IV,
  WorkflowStep.EXPORT_TABLE
];

export const ProjectStatus = {
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED"
} as const;

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const ProjectStepStatus = {
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  SKIPPED: "SKIPPED",
  BLOCKED: "BLOCKED"
} as const;

export type ProjectStepStatus =
  (typeof ProjectStepStatus)[keyof typeof ProjectStepStatus];

export const AssistantMessageType = {
  TOPIC_CONFIRM: "topic_confirm",
  SOP_GUIDE: "sop_guide",
  SKILL_OUTPUT: "skill_output",
  RESEARCH_CHAT: "research_chat",
  RESULT_INTERPRET: "result_interpret",
  STATA_ERROR_FIX: "stata_error_fix",
  SYSTEM_NOTICE: "system_notice"
} as const;

export type AssistantMessageType =
  (typeof AssistantMessageType)[keyof typeof AssistantMessageType];

export const SkillName = {
  TOPIC_DETECT: "topic_detect",
  TOPIC_NORMALIZE: "topic_normalize",
  SOP_GUIDE: "sop_guide",
  DATA_CLEANING: "data_cleaning",
  DATA_CHECK: "data_check",
  BASELINE_REGRESSION: "baseline_regression",
  ROBUSTNESS: "robustness",
  MECHANISM: "mechanism",
  HETEROGENEITY: "heterogeneity",
  IV: "iv",
  WORKFLOW_INPUT_INTERPRETER: "workflow_input_interpreter",
  GENERAL_RESEARCH_CHAT: "general_research_chat",
  RESULT_INTERPRET: "result_interpret",
  STATA_ERROR_DEBUG: "stata_error_debug",
  EXPORT_TABLE: "export_table"
} as const;

export type SkillName = (typeof SkillName)[keyof typeof SkillName];

export const RegressionSkillNames: SkillName[] = [
  SkillName.BASELINE_REGRESSION,
  SkillName.ROBUSTNESS,
  SkillName.MECHANISM,
  SkillName.HETEROGENEITY,
  SkillName.IV
];

export const ExportWriteMode = {
  REPLACE: "replace",
  APPEND: "append"
} as const;

export type ExportWriteMode =
  (typeof ExportWriteMode)[keyof typeof ExportWriteMode];
