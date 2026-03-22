import { z } from "zod";
import {
  AssistantMessageType,
  ExportWriteMode,
  MAIN_WORKFLOW_STEPS,
  ProjectStatus,
  ProjectStepStatus,
  SkillName,
  WorkflowStep
} from "./enums";

export const workflowStepSchema = z.enum(
  MAIN_WORKFLOW_STEPS as [WorkflowStep, ...WorkflowStep[]]
);
export const projectStatusSchema = z.enum([
  ProjectStatus.ACTIVE,
  ProjectStatus.ARCHIVED
]);
export const projectStepStatusSchema = z.enum([
  ProjectStepStatus.PENDING,
  ProjectStepStatus.IN_PROGRESS,
  ProjectStepStatus.COMPLETED,
  ProjectStepStatus.SKIPPED,
  ProjectStepStatus.BLOCKED
]);
export const assistantMessageTypeSchema = z.enum([
  AssistantMessageType.TOPIC_CONFIRM,
  AssistantMessageType.SOP_GUIDE,
  AssistantMessageType.SKILL_OUTPUT,
  AssistantMessageType.RESEARCH_CHAT,
  AssistantMessageType.RESULT_INTERPRET,
  AssistantMessageType.STATA_ERROR_FIX,
  AssistantMessageType.SYSTEM_NOTICE
]);
export const skillNameSchema = z.enum([
  SkillName.TOPIC_DETECT,
  SkillName.TOPIC_NORMALIZE,
  SkillName.SOP_GUIDE,
  SkillName.DATA_CLEANING,
  SkillName.DATA_CHECK,
  SkillName.BASELINE_REGRESSION,
  SkillName.ROBUSTNESS,
  SkillName.MECHANISM,
  SkillName.HETEROGENEITY,
  SkillName.IV,
  SkillName.WORKFLOW_INPUT_INTERPRETER,
  SkillName.GENERAL_RESEARCH_CHAT,
  SkillName.RESULT_INTERPRET,
  SkillName.STATA_ERROR_DEBUG,
  SkillName.EXPORT_TABLE
]);

export const termMappingCategorySchema = z.enum([
  "independent",
  "dependent",
  "control",
  "fixed_effect",
  "cluster",
  "panel",
  "time"
]);

export const termMappingSchema = z.object({
  category: termMappingCategorySchema,
  labelCn: z.string(),
  alias: z.string()
});

export const researchProfileSchema = z.object({
  projectId: z.string().uuid().optional(),
  normalizedTopic: z.string().optional().default(""),
  independentVariable: z.string().optional().default(""),
  dependentVariable: z.string().optional().default(""),
  researchObject: z.string().optional().default(""),
  relationship: z.string().optional().default(""),
  controls: z.array(z.string()).optional().default([]),
  fixedEffects: z.array(z.string()).optional().default([]),
  clusterVar: z.string().optional().nullable(),
  panelId: z.string().optional().nullable(),
  timeVar: z.string().optional().nullable(),
  sampleScope: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  termMappings: z.array(termMappingSchema).optional().default([])
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  topicRaw: z.string(),
  topicNormalized: z.string().nullable(),
  currentStep: workflowStepSchema,
  status: projectStatusSchema,
  researchSummary: z.string().nullable(),
  lastSkillName: skillNameSchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const projectExportStateSchema = z.object({
  projectId: z.string().uuid(),
  defaultExportPath: z.string(),
  defaultExportFileName: z.string(),
  hasWrittenRegressionTable: z.boolean(),
  nextWriteMode: z.enum([ExportWriteMode.REPLACE, ExportWriteMode.APPEND]),
  updatedAt: z.string()
});

export const projectStepSchema = z.object({
  step: workflowStepSchema,
  status: projectStepStatusSchema,
  startedAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional().default({})
});

export const assistantMessageEnvelopeSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  role: z.enum(["user", "assistant", "system"]),
  messageType: assistantMessageTypeSchema,
  step: workflowStepSchema.optional().nullable(),
  contentText: z.string().optional().nullable(),
  contentJson: z.record(z.any()),
  createdAt: z.string().optional()
});

export const topicDetectInputSchema = z.object({
  userInput: z.string().trim()
});

export const topicDetectOutputSchema = z.object({
  isValidTopic: z.boolean(),
  topicType: z.enum(["full_topic", "partial_topic", "not_topic"]),
  needsGuidance: z.boolean(),
  reason: z.string(),
  guidanceOptions: z.array(z.string()).optional().default([])
});

export const topicNormalizeInputSchema = z.object({
  rawTopic: z.string().min(1)
});

export const topicNormalizeOutputSchema = z.object({
  normalizedTopic: z.string(),
  independentVariable: z.string(),
  dependentVariable: z.string(),
  researchObject: z.string(),
  relationship: z.string(),
  confirmationMessage: z.string(),
  candidateTopics: z.array(z.string()).optional().default([])
});

export const sopGuideInputSchema = z.object({
  normalizedTopic: z.string(),
  researchObject: z.string().optional().default("")
});

export const sopGuideOutputSchema = z.object({
  steps: z.array(z.string()),
  recommendedStart: z.string(),
  message: z.string()
});

export const regressionExportSchema = z.object({
  fileName: z.string(),
  filePath: z.string(),
  writeMode: z.enum([ExportWriteMode.REPLACE, ExportWriteMode.APPEND]),
  exportCode: z.string()
});

export const dataCleaningInputSchema = z.object({
  dependentVariable: z.string().optional().default("y"),
  independentVariable: z.string().optional().default("x"),
  controls: z.array(z.string()).optional().default([]),
  needLogVars: z.array(z.string()).optional().default([]),
  fixedEffects: z.array(z.string()).optional().default([]),
  clusterVar: z.string().optional().nullable(),
  panelId: z.string().optional().nullable(),
  timeVar: z.string().optional().nullable(),
  sampleScope: z.string().optional().nullable(),
  termMappings: z.array(termMappingSchema).optional().default([])
});

export const dataCleaningOutputSchema = z.object({
  moduleName: z.literal("data_cleaning"),
  purpose: z.string(),
  meaning: z.string(),
  variableDesign: z.array(z.string()),
  termMappings: z.array(termMappingSchema).optional().default([]),
  modelSpec: z.string(),
  stataCode: z.string(),
  codeExplanation: z.array(z.string()),
  interpretationGuide: z.array(z.string()),
  nextSuggestion: z.string()
});

export const dataCheckInputSchema = z.object({
  panelId: z.string().optional().nullable(),
  timeVar: z.string().optional().nullable(),
  keyVariables: z.array(z.string()).default([])
});

export const dataCheckOutputSchema = z.object({
  moduleName: z.literal("data_check"),
  purpose: z.string(),
  meaning: z.string(),
  variableDesign: z.array(z.string()),
  modelSpec: z.string(),
  stataCode: z.string(),
  codeExplanation: z.array(z.string()),
  checkItems: z.array(z.string()),
  nextSuggestion: z.string()
});

export const regressionSkillInputSchema = z.object({
  dependentVariable: z.string().optional().default("y"),
  independentVariable: z.string().optional().default("x"),
  controls: z.array(z.string()).optional().default([]),
  fixedEffects: z.array(z.string()).optional().default([]),
  clusterVar: z.string().optional().nullable(),
  panelId: z.string().optional().nullable(),
  timeVar: z.string().optional().nullable(),
  exportState: regressionExportSchema
    .pick({
      fileName: true,
      filePath: true,
      writeMode: true
    })
    .optional(),
  sampleScope: z.string().optional().nullable(),
  termMappings: z.array(termMappingSchema).optional().default([])
});

export const regressionSkillOutputSchema = z.object({
  moduleName: z.string(),
  purpose: z.string(),
  meaning: z.string(),
  variableDesign: z.array(z.string()),
  termMappings: z.array(termMappingSchema).optional().default([]),
  instrumentSelectionCriteria: z.array(z.string()).optional().default([]),
  mechanismPaths: z.array(z.string()).optional().default([]),
  modelSpec: z.string(),
  stataCode: z.string(),
  codeExplanation: z.array(z.string()),
  interpretationGuide: z.array(z.string()),
  export: regressionExportSchema.optional(),
  nextSuggestion: z.string()
});

export const generalResearchChatInputSchema = z.object({
  userQuestion: z.string().min(1),
  currentModule: z.string().optional().default(""),
  topic: z.string().optional().default("")
});

export const generalResearchChatOutputSchema = z.object({
  answer: z.string(),
  keyPoints: z.array(z.string()).optional().default([]),
  suggestedNextActions: z.array(z.string()).optional().default([])
});

export const workflowInputInterpreterProfilePatchSchema = researchProfileSchema
  .pick({
    normalizedTopic: true,
    independentVariable: true,
    dependentVariable: true,
    researchObject: true,
    relationship: true,
    controls: true,
    fixedEffects: true,
    clusterVar: true,
    panelId: true,
    timeVar: true,
    sampleScope: true,
    notes: true
  })
  .partial();

export const workflowInputInterpreterInputSchema = z.object({
  userMessage: z.string().min(1),
  currentStep: workflowStepSchema,
  currentModule: z.string().optional().default(""),
  topic: z.string().optional().default(""),
  recentAssistantMessages: z.array(z.string()).optional().default([])
});

export const workflowInputInterpreterOutputSchema = z.object({
  route: z.enum(["continue_workflow", "ask_clarification", "general_research_chat"]),
  interpretedIntent: z.string(),
  normalizedUserMessage: z.string().optional().default(""),
  clarificationQuestion: z.string().optional().default(""),
  guidanceTitle: z.string().optional().default(""),
  guidanceOptions: z.array(z.string()).optional().default([]),
  reason: z.string().optional().default(""),
  confidence: z.enum(["high", "medium", "low"]).optional().default("medium"),
  profileUpdates: workflowInputInterpreterProfilePatchSchema.optional().default({})
});

export const resultInterpretInputSchema = z.object({
  resultText: z.string().min(1),
  currentModule: z.string(),
  topic: z.string()
});

export const resultInterpretOutputSchema = z.object({
  plainExplanation: z.string(),
  paperStyleExplanation: z.string(),
  analysisPoints: z.array(z.string()),
  missingInfo: z.array(z.string()).optional().default([]),
  nextSuggestion: z.string()
});

export const stataErrorDebugInputSchema = z.object({
  errorText: z.string().min(1),
  relatedCode: z.string().optional().nullable()
});

export const stataErrorDebugOutputSchema = z.object({
  errorType: z.string(),
  explanation: z.string(),
  fixCode: z.string(),
  retryMessage: z.string()
});

export const placeholderSkillOutputSchema = z.object({
  moduleName: z.string(),
  status: z.literal("coming_soon"),
  message: z.string(),
  export: regressionExportSchema.optional()
});

export const workflowNextInputSchema = z.object({
  userMessage: z.string().min(1),
  requestedStep: workflowStepSchema.optional(),
  payload: z.record(z.any()).optional().default({})
});

export const createProjectInputSchema = z.object({
  topicRaw: z.string().min(1)
});

export const createProjectOutputSchema = z.object({
  project: projectSchema,
  resumeToken: z.string()
});

export const projectDetailSchema = z.object({
  project: projectSchema,
  steps: z.array(projectStepSchema),
  researchProfile: researchProfileSchema.nullable(),
  exportState: projectExportStateSchema.nullable()
});

export type ResearchProfile = z.infer<typeof researchProfileSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectStep = z.infer<typeof projectStepSchema>;
export type AssistantMessageEnvelope = z.infer<
  typeof assistantMessageEnvelopeSchema
>;
export type TopicDetectInput = z.infer<typeof topicDetectInputSchema>;
export type TopicDetectOutput = z.infer<typeof topicDetectOutputSchema>;
export type TopicNormalizeInput = z.infer<typeof topicNormalizeInputSchema>;
export type TopicNormalizeOutput = z.infer<typeof topicNormalizeOutputSchema>;
export type SopGuideInput = z.infer<typeof sopGuideInputSchema>;
export type SopGuideOutput = z.infer<typeof sopGuideOutputSchema>;
export type DataCleaningInput = z.infer<typeof dataCleaningInputSchema>;
export type DataCleaningOutput = z.infer<typeof dataCleaningOutputSchema>;
export type DataCheckInput = z.infer<typeof dataCheckInputSchema>;
export type DataCheckOutput = z.infer<typeof dataCheckOutputSchema>;
export type RegressionSkillInput = z.infer<typeof regressionSkillInputSchema>;
export type RegressionSkillOutput = z.infer<typeof regressionSkillOutputSchema>;
export type GeneralResearchChatInput = z.infer<typeof generalResearchChatInputSchema>;
export type GeneralResearchChatOutput = z.infer<typeof generalResearchChatOutputSchema>;
export type WorkflowInputInterpreterProfilePatch = z.infer<typeof workflowInputInterpreterProfilePatchSchema>;
export type WorkflowInputInterpreterInput = z.infer<typeof workflowInputInterpreterInputSchema>;
export type WorkflowInputInterpreterOutput = z.infer<typeof workflowInputInterpreterOutputSchema>;
export type ResultInterpretInput = z.infer<typeof resultInterpretInputSchema>;
export type ResultInterpretOutput = z.infer<typeof resultInterpretOutputSchema>;
export type StataErrorDebugInput = z.infer<typeof stataErrorDebugInputSchema>;
export type StataErrorDebugOutput = z.infer<
  typeof stataErrorDebugOutputSchema
>;
export type TermMappingCategory = z.infer<typeof termMappingCategorySchema>;
export type TermMapping = z.infer<typeof termMappingSchema>;
export type PlaceholderSkillOutput = z.infer<
  typeof placeholderSkillOutputSchema
>;
export type ProjectExportState = z.infer<typeof projectExportStateSchema>;
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
