import { Injectable } from "@nestjs/common";
import {
  AssistantMessageType,
  ProjectStepStatus,
  SkillName,
  WorkflowStep,
  type DataDictionaryEntry,
  type ExportFormat,
  type ResearchSetupInterpreterOutput,
  type ResearchProfile,
  type WorkflowProgressPayload
} from "@empirical/shared";
import { MessagesService } from "../messages/messages.service";
import { ProjectsService } from "../projects/projects.service";
import { ResearchProfileService } from "../research-profile/research-profile.service";
import { SkillsService } from "../skills/skills.service";
import { HarnessService } from "../harness/harness.service";
import {
  DEFAULT_SETUP_EXAMPLE_MESSAGE,
  inferProfileUpdates,
  normalizeFixedEffects,
  wantsSetupExampleInput
} from "../skills/skill.utils";

type SetupDraft = {
  normalizedTopic: string;
  independentVariable: string;
  dependentVariable: string;
  researchObject: string;
  relationship: string;
  controls: string[];
  fixedEffects: string[];
  sampleScope: string;
  clusterVar: string;
  panelId: string;
  timeVar: string;
  analysisRoute: "panel_fe";
  didEnabled: boolean;
  psmEnabled: boolean;
  treatmentVar: string;
  policyTimeVar: string;
  policyStartYear: string;
  instrumentVariable: string;
  psmMatchVars: string[];
  mechanismVariables: string[];
  heterogeneityVars: string[];
  exportFormats: ExportFormat[];
  notes: string;
  dataDictionary: DataDictionaryEntry[];
};

type SetupFieldKey =
  | "normalizedTopic"
  | "researchObject"
  | "independentVariable"
  | "dependentVariable"
  | "controls"
  | "sampleScope"
  | "fixedEffects"
  | "panelId"
  | "timeVar"
  | "instrumentVariable"
  | "treatmentVar"
  | "policyStartYear"
  | "psmMatchVars";

type WorkflowRunEntry = {
  step: WorkflowStep;
  skillName: SkillName;
  contentText: string;
};

type WorkflowModuleTask = {
  id: "data" | "baseline" | "robustness" | "iv" | "mechanism" | "heterogeneity";
  label: string;
  entries: WorkflowRunEntry[];
};

const DEFAULT_RELATIONSHIP_LABEL = "正向、负向和不显著";
const DEFAULT_RESEARCH_OBJECT = "中国A股上市公司";
const EXPORT_FORMATS = new Set<ExportFormat>(["word", "latex", "excel", "stata_do"]);

const REQUIRED_SETUP_FIELDS: Array<{ key: SetupFieldKey; label: string; example: string }> = [
  { key: "normalizedTopic", label: "研究主题", example: "研究主题：数字金融对企业创新的影响" },
  { key: "researchObject", label: "研究对象", example: "研究对象：中国A股上市公司（剔除ST和金融股）" },
  { key: "independentVariable", label: "解释变量", example: "解释变量：数字金融" },
  { key: "dependentVariable", label: "被解释变量", example: "被解释变量：企业创新" },
  {
    key: "controls",
    label: "控制变量",
    example: "控制变量：企业规模、资产负债率、ROA、现金流、股权集中度"
  },
  { key: "sampleScope", label: "样本区间", example: "样本区间：2011-2022年" },
  { key: "fixedEffects", label: "固定效应", example: "固定效应：企业固定效应、年份固定效应" }
];

const GENERATED_WORKFLOW: WorkflowRunEntry[] = [
  {
    step: WorkflowStep.SOP_GUIDE,
    skillName: SkillName.SOP_GUIDE,
    contentText: "我已经整理出这项研究的完整推进路径。"
  },
  {
    step: WorkflowStep.DATA_CLEANING,
    skillName: SkillName.DATA_CLEANING,
    contentText: "我已经生成数据处理与清洗建议。"
  },
  {
    step: WorkflowStep.DATA_CHECK,
    skillName: SkillName.DATA_CHECK,
    contentText: "我已经生成数据检查与描述统计建议。"
  },
  {
    step: WorkflowStep.BASELINE_REGRESSION,
    skillName: SkillName.BASELINE_REGRESSION,
    contentText: "我已经生成基准回归代码与导出命令。"
  },
  {
    step: WorkflowStep.ROBUSTNESS,
    skillName: SkillName.ROBUSTNESS,
    contentText: "我已经生成稳健性检验方案与代码模板。"
  },
  {
    step: WorkflowStep.IV,
    skillName: SkillName.IV,
    contentText: "我已经生成内生性分析与工具变量模板。"
  },
  {
    step: WorkflowStep.MECHANISM,
    skillName: SkillName.MECHANISM,
    contentText: "我已经生成机制分析思路与代码模板。"
  },
  {
    step: WorkflowStep.HETEROGENEITY,
    skillName: SkillName.HETEROGENEITY,
    contentText: "我已经生成异质性分析方案与代码模板。"
  }
];

const DATA_WORKFLOW_STEPS = new Set<WorkflowStep>([
  WorkflowStep.SOP_GUIDE,
  WorkflowStep.DATA_CLEANING,
  WorkflowStep.DATA_CHECK
]);

const GENERATED_WORKFLOW_MODULES: WorkflowModuleTask[] = [
  {
    id: "data",
    label: "路径与数据",
    entries: GENERATED_WORKFLOW.filter((entry) => DATA_WORKFLOW_STEPS.has(entry.step))
  },
  {
    id: "baseline",
    label: "基准回归",
    entries: GENERATED_WORKFLOW.filter((entry) => entry.step === WorkflowStep.BASELINE_REGRESSION)
  },
  {
    id: "robustness",
    label: "稳健性检验",
    entries: GENERATED_WORKFLOW.filter((entry) => entry.step === WorkflowStep.ROBUSTNESS)
  },
  {
    id: "iv",
    label: "内生性分析",
    entries: GENERATED_WORKFLOW.filter((entry) => entry.step === WorkflowStep.IV)
  },
  {
    id: "mechanism",
    label: "机制分析",
    entries: GENERATED_WORKFLOW.filter((entry) => entry.step === WorkflowStep.MECHANISM)
  },
  {
    id: "heterogeneity",
    label: "异质性分析",
    entries: GENERATED_WORKFLOW.filter((entry) => entry.step === WorkflowStep.HETEROGENEITY)
  }
];

const TOTAL_WORKFLOW_STAGE_COUNT = 7;
const WORKFLOW_GENERATION_CONCURRENCY = 3;
const WORKFLOW_GENERATION_RETRIES = 2;

@Injectable()
export class WorkflowService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly messagesService: MessagesService,
    private readonly researchProfileService: ResearchProfileService,
    private readonly skillsService: SkillsService,
    private readonly harnessService: HarnessService
  ) {}

  async handleNext(params: {
    projectId: string;
    resumeToken?: string;
    userMessage: string;
    requestedStep?: WorkflowStep;
    payload?: Record<string, unknown>;
    agentRunId?: string | null;
    onProgress?: (progress: WorkflowProgressPayload) => void | Promise<void>;
  }) {
    const project = await this.projectsService.assertProjectAccess(
      params.projectId,
      params.resumeToken
    );

    const requestedStep = (params.requestedStep ?? project.currentStep) as WorkflowStep;
    const budgetedMessage = await this.harnessService.budgetUserMessage({
      projectId: params.projectId,
      runId: params.agentRunId ?? null,
      userMessage: params.userMessage
    });
    const userMessage = budgetedMessage.userMessage;

    await this.messagesService.createMessage({
      projectId: params.projectId,
      role: "user",
      messageType: AssistantMessageType.SYSTEM_NOTICE,
      step: requestedStep,
      contentText: userMessage,
      contentJson: {
        userMessage,
        artifactIds: budgetedMessage.artifactIds,
        payload: params.payload ?? {},
        requestedStep
      }
    });

    if (this.looksLikeStataError(userMessage)) {
      return this.runSideSkill(
        params.projectId,
        requestedStep,
        SkillName.STATA_ERROR_DEBUG,
        { userMessage, ...params.payload },
        project.currentStep as WorkflowStep,
        params.agentRunId
      );
    }

    if (this.looksLikeRegressionResult(userMessage)) {
      return this.runSideSkill(
        params.projectId,
        requestedStep,
        SkillName.RESULT_INTERPRET,
        {
          userMessage,
          currentModule: requestedStep,
          ...params.payload
        },
        project.currentStep as WorkflowStep,
        params.agentRunId
      );
    }

    if (this.isSetupStep(requestedStep)) {
      if (wantsSetupExampleInput(userMessage)) {
        return this.runSetupInterpreterMessage(params.projectId, requestedStep, {
          intent: "research_question",
          profileUpdates: {},
          missingFields: [],
          // 示例请求直接回答，不进入 handleSetupCollection，因此不会写入 researchProfile。
          assistantMessage: DEFAULT_SETUP_EXAMPLE_MESSAGE,
          confidence: "high"
        });
      }

      if (this.isConfirmation(userMessage)) {
        return this.handleSetupCollection(
          params.projectId,
          userMessage,
          params.payload ?? {},
          true,
          params.agentRunId,
          params.onProgress
        );
      }

      const setupInterpreter = await this.skillsService.executeSkill({
        projectId: params.projectId,
        skillName: SkillName.RESEARCH_SETUP_INTERPRETER,
        step: requestedStep,
        payload: {
          userMessage,
          currentStep: requestedStep,
          currentModule: requestedStep
        },
        agentRunId: params.agentRunId
      });
      const setupData = setupInterpreter.data as ResearchSetupInterpreterOutput;

      if (setupData.intent === "research_question" || setupData.intent === "irrelevant") {
        return this.runSetupInterpreterMessage(params.projectId, requestedStep, setupData);
      }

      const interpretedUpdates = this.cleanProfileUpdatePayload(setupData.profileUpdates ?? {});
      const deterministicUpdates = this.cleanProfileUpdatePayload(inferProfileUpdates(userMessage) as Record<string, unknown>);
      const effectivePayload = this.applyMethodNegationCleanup(
        userMessage,
        this.mergeModelFirstProfileUpdates(params.payload ?? {}, deterministicUpdates, interpretedUpdates)
      );

      return this.handleSetupCollection(
        params.projectId,
        userMessage,
        effectivePayload,
        false,
        params.agentRunId,
        params.onProgress,
        setupData
      );
    }

    const interpreter = await this.skillsService.executeSkill({
      projectId: params.projectId,
      skillName: SkillName.WORKFLOW_INPUT_INTERPRETER,
      step: requestedStep,
      payload: {
        userMessage,
        currentStep: requestedStep,
        currentModule: requestedStep
      },
      agentRunId: params.agentRunId
    });

    const interpretedUpdates = this.cleanProfileUpdatePayload(
      (interpreter.data.profileUpdates as Record<string, unknown> | undefined) ?? {}
    );
    const deterministicUpdates = this.cleanProfileUpdatePayload(inferProfileUpdates(userMessage) as Record<string, unknown>);
    const effectivePayload = this.applyMethodNegationCleanup(
      userMessage,
      this.mergeModelFirstProfileUpdates(params.payload ?? {}, deterministicUpdates, interpretedUpdates)
    );
    const effectiveUserMessage =
      (typeof interpreter.data.normalizedUserMessage === "string" &&
        interpreter.data.normalizedUserMessage.trim()) || userMessage;

    if (this.hasSetupUpdates(effectivePayload)) {
      return this.resetToSetupConfirmation(
        params.projectId,
        effectiveUserMessage,
        effectivePayload,
        "研究设定已变化。我先帮您更新摘要，确认后会重新生成整套 Stata 工作流。",
        params.agentRunId
      );
    }

    if (interpreter.data.route === "ask_clarification") {
      return this.runSystemNotice(params.projectId, requestedStep, {
        message: interpreter.data.clarificationQuestion,
        reason: interpreter.data.reason,
        guidanceTitle: interpreter.data.guidanceTitle,
        guidanceOptions: interpreter.data.guidanceOptions,
        interpretedIntent: interpreter.data.interpretedIntent,
        confidence: interpreter.data.confidence
      });
    }

    if (interpreter.data.route === "general_research_chat") {
      return this.runSideSkill(
        params.projectId,
        requestedStep,
        SkillName.GENERAL_RESEARCH_CHAT,
        {
          userQuestion: effectiveUserMessage,
          currentModule: requestedStep,
          ...effectivePayload
        },
        project.currentStep as WorkflowStep,
        params.agentRunId
      );
    }

    return this.handleGeneratedModuleInput(
      params.projectId,
      requestedStep,
      effectiveUserMessage,
      effectivePayload,
      project.currentStep as WorkflowStep,
      params.agentRunId
    );
  }

  private async runSetupInterpreterMessage(
    projectId: string,
    currentStep: WorkflowStep,
    setupData: ResearchSetupInterpreterOutput
  ) {
    const assistantText = this.normalizeSetupInterpreterAssistantMessage(setupData);
    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType:
        setupData.intent === "research_question"
          ? AssistantMessageType.RESEARCH_CHAT
          : AssistantMessageType.SYSTEM_NOTICE,
      step: currentStep,
      contentText: assistantText,
      contentJson: {
        ...setupData,
        assistantMessage: assistantText
      } as unknown as Record<string, unknown>
    });

    return {
      projectId,
      currentStep,
      assistantMessage
    };
  }

  private normalizeSetupInterpreterAssistantMessage(setupData: ResearchSetupInterpreterOutput) {
    const text = setupData.assistantMessage.trim();
    if (setupData.intent !== "irrelevant") {
      return text;
    }

    if (/无关|非科研|不属于.*科研|和.*研究.*无关/.test(text)) {
      return text;
    }

    return `您刚才的内容似乎和经管实证论文研究无关。${text}`;
  }

  private async handleSetupCollection(
    projectId: string,
    userMessage: string,
    payload: Record<string, unknown>,
    confirmed: boolean,
    agentRunId?: string | null,
    onProgress?: (progress: WorkflowProgressPayload) => void | Promise<void>,
    setupInterpretation?: ResearchSetupInterpreterOutput
  ) {
    const draft = await this.buildSetupDraft(projectId, userMessage, payload, agentRunId);
    const missingFields = this.getMissingSetupFields(draft);
    const hasAnySetupContent = this.hasAnySetupContent(draft);

    await this.projectsService.updateStepStatus(
      projectId,
      WorkflowStep.TOPIC_DETECT,
      hasAnySetupContent ? ProjectStepStatus.COMPLETED : ProjectStepStatus.IN_PROGRESS,
      {}
    );
    await this.projectsService.updateStepStatus(
      projectId,
      WorkflowStep.TOPIC_NORMALIZE,
      ProjectStepStatus.IN_PROGRESS,
      {}
    );
    await this.projectsService.updateCurrentStep(projectId, WorkflowStep.TOPIC_NORMALIZE, SkillName.TOPIC_NORMALIZE);

    if (!hasAnySetupContent || this.isMeaninglessSetupInput(userMessage, draft)) {
      const prompt = this.buildSetupCollectionPrompt();
      return this.runSystemNotice(projectId, WorkflowStep.TOPIC_NORMALIZE, {
        ...prompt,
        ...(setupInterpretation?.assistantMessage ? { message: setupInterpretation.assistantMessage } : {}),
        intent: setupInterpretation?.intent,
        confidence: setupInterpretation?.confidence
      });
    }

    await this.persistSetupDraft(projectId, draft);

    if (missingFields.length > 0) {
      const notice = this.buildMissingFieldsNotice(draft, missingFields);
      const payload = {
        ...notice,
        ...(setupInterpretation?.assistantMessage ? { message: setupInterpretation.assistantMessage } : {}),
        intent: setupInterpretation?.intent,
        modelMissingFields: setupInterpretation?.missingFields ?? [],
        confidence: setupInterpretation?.confidence
      };

      if (confirmed) {
        return this.runSystemNotice(projectId, WorkflowStep.TOPIC_NORMALIZE, payload);
      }

      return this.runSystemNotice(projectId, WorkflowStep.TOPIC_NORMALIZE, payload);
    }

    if (!confirmed) {
      const assistantMessage = await this.messagesService.createMessage({
        projectId,
        role: "assistant",
        messageType: AssistantMessageType.TOPIC_CONFIRM,
        step: WorkflowStep.TOPIC_NORMALIZE,
        contentText:
          setupInterpretation?.assistantMessage ||
          "我已经整理好一版研究设定。确认后我会一次性生成完整的 Stata 工作流。",
        contentJson: {
          ...this.buildSetupConfirmationContent(draft),
          intent: setupInterpretation?.intent ?? "research_setup",
          missingFields: [],
          modelMissingFields: setupInterpretation?.missingFields ?? [],
          confidence: setupInterpretation?.confidence
        }
      });

      return {
        projectId,
        currentStep: WorkflowStep.TOPIC_NORMALIZE,
        assistantMessage
      };
    }

    await this.researchProfileService.mergeExplicitUpdates(projectId, draft as unknown as Partial<ResearchProfile>);
    const primaryMessage = await this.runFullWorkflowGeneration(projectId, draft, agentRunId, onProgress);

    return {
      projectId,
      currentStep: WorkflowStep.DATA_CLEANING,
      assistantMessage: primaryMessage
    };
  }

  private async handleGeneratedModuleInput(
    projectId: string,
    requestedStep: WorkflowStep,
    userMessage: string,
    payload: Record<string, unknown>,
    projectCurrentStep: WorkflowStep,
    agentRunId?: string | null
  ) {
    if (this.wantsRegenerateModule(userMessage)) {
      return this.runModuleSkill(projectId, requestedStep, payload, projectCurrentStep, agentRunId);
    }

    if (this.wantsNext(userMessage)) {
      return this.runSystemNotice(projectId, requestedStep, {
        message: "整套工作流已经生成完成。您可以点击上方模块查看对应内容，或直接在当前模块继续追问与修改。"
      });
    }

    return this.runSideSkill(
      projectId,
      requestedStep,
      SkillName.GENERAL_RESEARCH_CHAT,
      {
        userQuestion: userMessage,
        currentModule: requestedStep,
        ...payload
      },
      projectCurrentStep,
      agentRunId
    );
  }

  private async resetToSetupConfirmation(
    projectId: string,
    userMessage: string,
    payload: Record<string, unknown>,
    message: string,
    agentRunId?: string | null
  ) {
    const beforeProfile = await this.researchProfileService.getByProjectId(projectId);
    const draft = await this.buildSetupDraft(projectId, userMessage, payload, agentRunId);
    const profileDiff = this.harnessService.buildProfileDiff(
      beforeProfile ? this.profileSnapshot(beforeProfile as unknown as Record<string, unknown>) : null,
      this.profileSnapshot(draft as unknown as Record<string, unknown>)
    );
    await this.persistSetupDraft(projectId, draft);
    await this.resetGeneratedSteps(projectId);
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_DETECT, ProjectStepStatus.COMPLETED, {});
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_NORMALIZE, ProjectStepStatus.IN_PROGRESS, {});
    await this.projectsService.updateCurrentStep(projectId, WorkflowStep.TOPIC_NORMALIZE, SkillName.TOPIC_NORMALIZE);

    const missingFields = this.getMissingSetupFields(draft);

    if (missingFields.length > 0) {
      return this.runSystemNotice(projectId, WorkflowStep.TOPIC_NORMALIZE, this.buildMissingFieldsNotice(draft, missingFields, message));
    }

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: AssistantMessageType.TOPIC_CONFIRM,
      step: WorkflowStep.TOPIC_NORMALIZE,
      contentText: message,
      contentJson: {
        ...this.buildSetupConfirmationContent(draft),
        profileDiff
      }
    });

    return {
      projectId,
      currentStep: WorkflowStep.TOPIC_NORMALIZE,
      assistantMessage
    };
  }

  private async buildSetupDraft(
    projectId: string,
    userMessage: string,
    payload: Record<string, unknown>,
    agentRunId?: string | null
  ): Promise<SetupDraft> {
    const stored = await this.researchProfileService.getByProjectId(projectId);
    const draft: SetupDraft = {
      normalizedTopic: this.stringValue(payload.normalizedTopic) || stored?.normalizedTopic || "",
      independentVariable: this.stringValue(payload.independentVariable) || stored?.independentVariable || "",
      dependentVariable: this.stringValue(payload.dependentVariable) || stored?.dependentVariable || "",
      researchObject:
        this.normalizeResearchObjectDraft(this.stringValue(payload.researchObject)) ||
        this.normalizeResearchObjectDraft(stored?.researchObject) ||
        "",
      relationship: this.normalizeRelationshipLabel(
        this.stringValue(payload.relationship) || stored?.relationship || DEFAULT_RELATIONSHIP_LABEL,
        this.stringValue(payload.normalizedTopic) || stored?.normalizedTopic || ""
      ),
      controls: this.arrayValue(payload.controls).length > 0 ? this.arrayValue(payload.controls) : stored?.controls ?? [],
      fixedEffects: normalizeFixedEffects(
        this.arrayValue(payload.fixedEffects).length > 0 ? this.arrayValue(payload.fixedEffects) : stored?.fixedEffects ?? []
      ),
      sampleScope: this.stringValue(payload.sampleScope) || stored?.sampleScope || "",
      clusterVar: this.stringValue(payload.clusterVar) || stored?.clusterVar || "",
      panelId: this.stringValue(payload.panelId) || stored?.panelId || "",
      timeVar: this.stringValue(payload.timeVar) || stored?.timeVar || "",
      analysisRoute: "panel_fe",
      didEnabled: this.booleanValue(payload.didEnabled, stored?.didEnabled ?? false),
      psmEnabled: this.booleanValue(payload.psmEnabled, stored?.psmEnabled ?? false),
      treatmentVar: this.stringValue(payload.treatmentVar) || stored?.treatmentVar || "",
      policyTimeVar: this.stringValue(payload.policyTimeVar) || stored?.policyTimeVar || "",
      policyStartYear: this.stringValue(payload.policyStartYear) || stored?.policyStartYear || "",
      instrumentVariable: this.stringValue(payload.instrumentVariable) || stored?.instrumentVariable || "",
      psmMatchVars:
        this.arrayValue(payload.psmMatchVars).length > 0
          ? this.arrayValue(payload.psmMatchVars)
          : stored?.psmMatchVars ?? [],
      mechanismVariables:
        this.arrayValue(payload.mechanismVariables).length > 0
          ? this.arrayValue(payload.mechanismVariables)
          : stored?.mechanismVariables ?? [],
      heterogeneityVars:
        this.arrayValue(payload.heterogeneityVars).length > 0
          ? this.arrayValue(payload.heterogeneityVars)
          : stored?.heterogeneityVars ?? [],
      exportFormats:
        this.arrayValue(payload.exportFormats).length > 0
          ? this.normalizeExportFormats(this.arrayValue(payload.exportFormats))
          : this.normalizeExportFormats(stored?.exportFormats ?? []),
      notes: this.stringValue(payload.notes) || stored?.notes || "",
      dataDictionary:
        this.dataDictionaryValue(payload.dataDictionary).length > 0
          ? this.dataDictionaryValue(payload.dataDictionary)
          : stored?.dataDictionary ?? []
    };

    if (draft.controls.length === 0 && typeof payload.controls === "string") {
      draft.controls = this.splitItems(String(payload.controls));
    }
    if (draft.fixedEffects.length === 0 && typeof payload.fixedEffects === "string") {
      draft.fixedEffects = normalizeFixedEffects(String(payload.fixedEffects));
    }
    if (draft.psmMatchVars.length === 0 && typeof payload.psmMatchVars === "string") {
      draft.psmMatchVars = this.splitItems(String(payload.psmMatchVars));
    }
    if (draft.mechanismVariables.length === 0 && typeof payload.mechanismVariables === "string") {
      draft.mechanismVariables = this.splitItems(String(payload.mechanismVariables));
    }
    if (draft.heterogeneityVars.length === 0 && typeof payload.heterogeneityVars === "string") {
      draft.heterogeneityVars = this.splitItems(String(payload.heterogeneityVars));
    }
    if (draft.exportFormats.length === 0 && typeof payload.exportFormats === "string") {
      draft.exportFormats = this.normalizeExportFormats(this.splitItems(String(payload.exportFormats)));
    }
    if (!draft.sampleScope) {
      draft.sampleScope = this.inferSampleScopeFromText(userMessage);
    }

    if ((draft.normalizedTopic && !draft.independentVariable) || (draft.normalizedTopic && !draft.dependentVariable)) {
      const inferredFromTopic = this.inferTopicFromSentence(draft.normalizedTopic);
      draft.independentVariable ||= inferredFromTopic.independentVariable;
      draft.dependentVariable ||= inferredFromTopic.dependentVariable;
    }

    if (!draft.normalizedTopic && draft.independentVariable && draft.dependentVariable) {
      draft.normalizedTopic = `${draft.independentVariable}对${draft.dependentVariable}的影响研究`;
    }

    if (this.shouldTryNormalizeTopic(userMessage, draft)) {
      try {
        const normalized = await this.skillsService.executeSkill({
          projectId,
          skillName: SkillName.TOPIC_NORMALIZE,
          step: WorkflowStep.TOPIC_NORMALIZE,
          payload: {
            rawTopic: userMessage
          },
          agentRunId
        });
        const normalizedData = normalized.data as {
          normalizedTopic?: string;
          independentVariable?: string;
          dependentVariable?: string;
        };
        draft.normalizedTopic ||= this.stringValue(normalizedData.normalizedTopic);
        draft.independentVariable ||= this.stringValue(normalizedData.independentVariable);
        draft.dependentVariable ||= this.stringValue(normalizedData.dependentVariable);
      } catch {
        // keep deterministic draft
      }
    }

    if ((!draft.independentVariable || !draft.dependentVariable) && draft.normalizedTopic) {
      const inferred = this.inferTopicFromSentence(draft.normalizedTopic);
      draft.independentVariable ||= inferred.independentVariable;
      draft.dependentVariable ||= inferred.dependentVariable;
    }

    if (!draft.normalizedTopic && draft.independentVariable && draft.dependentVariable) {
      draft.normalizedTopic = `${draft.independentVariable}对${draft.dependentVariable}的影响研究`;
    }

    draft.relationship = DEFAULT_RELATIONSHIP_LABEL;
    if (/(?:不做|暂时不做|先不做|不使用|不用|不需要|无需).{0,12}(?:PSM|倾向得分匹配)/i.test(userMessage)) {
      draft.psmEnabled = false;
      draft.psmMatchVars = [];
    }
    if (/(?:不做|暂时不做|先不做|不使用|不用|不需要|无需).{0,12}(?:DID|双重差分)/i.test(userMessage)) {
      draft.didEnabled = false;
      draft.policyTimeVar = "";
      draft.policyStartYear = "";
    }
    if (!draft.didEnabled && !draft.psmEnabled) {
      draft.treatmentVar = "";
    }
    if (/(?:不做|暂时不做|先不做|不使用|不用|不需要|无需).{0,12}(?:IV|工具变量|工具变量法)/i.test(userMessage)) {
      draft.instrumentVariable = "";
    }
    if (draft.didEnabled && draft.timeVar) {
      draft.policyTimeVar ||= draft.timeVar;
    }
    if (!draft.exportFormats.length) {
      draft.exportFormats = ["word", "stata_do"];
    }

    return draft;
  }

  private async persistSetupDraft(projectId: string, draft: SetupDraft) {
    await this.researchProfileService.mergeExplicitUpdates(projectId, {
      normalizedTopic: draft.normalizedTopic,
      independentVariable: draft.independentVariable,
      dependentVariable: draft.dependentVariable,
      researchObject: draft.researchObject,
      relationship: draft.relationship,
      controls: draft.controls,
      fixedEffects: draft.fixedEffects,
      sampleScope: draft.sampleScope || null,
      analysisRoute: draft.analysisRoute,
      didEnabled: draft.didEnabled,
      psmEnabled: draft.psmEnabled,
      clusterVar: draft.clusterVar || null,
      panelId: draft.panelId || null,
      timeVar: draft.timeVar || null,
      treatmentVar: draft.treatmentVar || null,
      policyTimeVar: draft.policyTimeVar || null,
      policyStartYear: draft.policyStartYear || null,
      instrumentVariable: draft.instrumentVariable || null,
      psmMatchVars: draft.psmMatchVars,
      mechanismVariables: draft.mechanismVariables,
      heterogeneityVars: draft.heterogeneityVars,
      exportFormats: draft.exportFormats,
      notes: draft.notes || null,
      dataDictionary: draft.dataDictionary
    });

    if (draft.normalizedTopic) {
      await this.projectsService.updateTopic(projectId, draft.normalizedTopic);
    }
  }

  private async runFullWorkflowGeneration(
    projectId: string,
    draft: SetupDraft,
    agentRunId?: string | null,
    onProgress?: (progress: WorkflowProgressPayload) => void | Promise<void>
  ) {
    await this.resetGeneratedSteps(projectId);
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_DETECT, ProjectStepStatus.COMPLETED, {});
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_NORMALIZE, ProjectStepStatus.COMPLETED, {});

    let primaryMessage = null as Awaited<ReturnType<MessagesService["createMessage"]>> | null;
    let completedCount = 1;

    if (onProgress) {
      await onProgress({
        currentCount: completedCount,
        totalCount: TOTAL_WORKFLOW_STAGE_COUNT,
        stageLabel: "主题确认",
        remainingMinutes: 5
      });
    }

    let nextTaskIndex = 0;

    // The workflow generates independent product modules with bounded concurrency.
    // Each module may contain one or more ordered skills, but progress advances only
    // when a user-facing module finishes successfully.
    const runWorker = async () => {
      while (nextTaskIndex < GENERATED_WORKFLOW_MODULES.length) {
        const task = GENERATED_WORKFLOW_MODULES[nextTaskIndex];
        nextTaskIndex += 1;

        if (!task) {
          continue;
        }

        try {
          const result = await this.runWorkflowModuleTask(projectId, draft, task, agentRunId);
          if (result.primaryMessage) {
            primaryMessage = result.primaryMessage;
          }
          completedCount += 1;
          if (onProgress) {
            const remainingStages = Math.max(0, TOTAL_WORKFLOW_STAGE_COUNT - completedCount);
            await onProgress({
              currentCount: completedCount,
              totalCount: TOTAL_WORKFLOW_STAGE_COUNT,
              stageLabel: task.label,
              remainingMinutes: remainingStages === 0 ? 0 : Math.max(1, Math.ceil(remainingStages * 0.8))
            });
          }
        } catch (error) {
          await this.createWorkflowModuleFailureNotice(projectId, task, error);
        }
      }
    };

    await Promise.all(
      Array.from(
        { length: Math.min(WORKFLOW_GENERATION_CONCURRENCY, GENERATED_WORKFLOW_MODULES.length) },
        () => runWorker()
      )
    );

    await this.projectsService.updateStepStatus(projectId, WorkflowStep.DATA_CLEANING, ProjectStepStatus.IN_PROGRESS, {
      generatedInBatch: true,
      selectedByDefault: true
    });
    await this.projectsService.updateCurrentStep(projectId, WorkflowStep.DATA_CLEANING, SkillName.DATA_CLEANING);

    if (primaryMessage) {
      return primaryMessage;
    }

    const fallbackMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: AssistantMessageType.SYSTEM_NOTICE,
      step: WorkflowStep.DATA_CLEANING,
      contentText: "我已经生成完整的 Stata 工作流，可以在上方模块中分别查看。",
      contentJson: {
        message: "我已经生成完整的 Stata 工作流，可以在上方模块中分别查看。"
      }
    });

    return fallbackMessage;
  }

  private buildWorkflowSkillPayload(draft: SetupDraft) {
    return {
      normalizedTopic: draft.normalizedTopic,
      researchObject: draft.researchObject,
      independentVariable: draft.independentVariable,
      dependentVariable: draft.dependentVariable,
      controls: draft.controls,
      fixedEffects: draft.fixedEffects,
      sampleScope: draft.sampleScope,
      clusterVar: draft.clusterVar || undefined,
      panelId: draft.panelId || undefined,
      timeVar: draft.timeVar || undefined,
      analysisRoute: draft.analysisRoute,
      didEnabled: draft.didEnabled,
      psmEnabled: draft.psmEnabled,
      treatmentVar: draft.treatmentVar || undefined,
      policyTimeVar: draft.policyTimeVar || undefined,
      policyStartYear: draft.policyStartYear || undefined,
      instrumentVariable: draft.instrumentVariable || undefined,
      psmMatchVars: draft.psmMatchVars,
      mechanismVariables: draft.mechanismVariables,
      heterogeneityVars: draft.heterogeneityVars,
      exportFormats: draft.exportFormats,
      notes: draft.notes || undefined,
      dataDictionary: draft.dataDictionary
    };
  }

  private async runWorkflowModuleTask(
    projectId: string,
    draft: SetupDraft,
    task: WorkflowModuleTask,
    agentRunId?: string | null
  ) {
    let primaryMessage = null as Awaited<ReturnType<MessagesService["createMessage"]>> | null;

    for (const entry of task.entries) {
      await this.projectsService.updateStepStatus(projectId, entry.step, ProjectStepStatus.IN_PROGRESS, {
        generatedInBatch: true,
        moduleId: task.id
      });

      const assistantMessage = await this.retryWorkflowEntry(projectId, draft, entry, agentRunId);

      await this.projectsService.updateStepStatus(projectId, entry.step, ProjectStepStatus.COMPLETED, {
        generatedInBatch: true,
        moduleId: task.id
      });

      if (entry.step === WorkflowStep.DATA_CLEANING) {
        primaryMessage = assistantMessage;
      }
    }

    return { primaryMessage };
  }

  private async retryWorkflowEntry(
    projectId: string,
    draft: SetupDraft,
    entry: WorkflowRunEntry,
    agentRunId?: string | null
  ) {
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= WORKFLOW_GENERATION_RETRIES; attempt += 1) {
      try {
        const run = await this.skillsService.executeSkill({
          projectId,
          skillName: entry.skillName,
          step: entry.step,
          payload: this.buildWorkflowSkillPayload(draft),
          agentRunId
        });

        return this.messagesService.createMessage({
          projectId,
          role: "assistant",
          messageType: run.messageType,
          step: entry.step,
          contentText: entry.contentText,
          contentJson: run.data
        });
      } catch (error) {
        lastError = error;
        if (attempt < WORKFLOW_GENERATION_RETRIES) {
          await this.sleep(1000 * 2 ** attempt);
        }
      }
    }

    await this.projectsService.updateStepStatus(projectId, entry.step, ProjectStepStatus.BLOCKED, {
      generatedInBatch: true,
      error: lastError instanceof Error ? lastError.message : "模块生成失败"
    });
    throw lastError instanceof Error ? lastError : new Error("模块生成失败");
  }

  private async createWorkflowModuleFailureNotice(projectId: string, task: WorkflowModuleTask, error: unknown) {
    await Promise.all(
      task.entries.map((entry) =>
        this.projectsService.updateStepStatus(projectId, entry.step, ProjectStepStatus.BLOCKED, {
          generatedInBatch: true,
          moduleId: task.id,
          error: error instanceof Error ? error.message : "模块生成失败"
        })
      )
    );

    await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: AssistantMessageType.SYSTEM_NOTICE,
      step: task.entries[0]?.step ?? WorkflowStep.DATA_CLEANING,
      contentText: `${task.label}生成失败，稍后可以在该模块中重新生成。`,
      contentJson: {
        message: `${task.label}生成失败，稍后可以在该模块中重新生成。`,
        error: error instanceof Error ? error.message : "模块生成失败"
      }
    });
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async resetGeneratedSteps(projectId: string) {
    await this.messagesService.clearAssistantMessagesForSteps(
      projectId,
      GENERATED_WORKFLOW.map((entry) => entry.step)
    );

    for (const entry of GENERATED_WORKFLOW) {
      await this.projectsService.updateStepStatus(projectId, entry.step, ProjectStepStatus.PENDING, {});
    }
  }

  private async clearSetupAssistantMessages(projectId: string) {
    await this.messagesService.clearAssistantMessagesForSteps(projectId, [
      WorkflowStep.TOPIC_DETECT,
      WorkflowStep.TOPIC_NORMALIZE
    ]);
  }

  private async runModuleSkill(
    projectId: string,
    requestedStep: WorkflowStep,
    payload: Record<string, unknown>,
    projectCurrentStep: WorkflowStep,
    agentRunId?: string | null
  ) {
    const skillName = this.resolveSkillForStep(requestedStep);
    if (!skillName) {
      return this.runSystemNotice(projectId, requestedStep, {
        message: "这个模块暂时不支持单独重跑，请先调整研究设定后重新生成。"
      });
    }

    const run = await this.skillsService.executeSkill({
      projectId,
      skillName,
      step: requestedStep,
      payload,
      agentRunId
    });

    await this.messagesService.clearAssistantMessagesForSteps(projectId, [requestedStep]);

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: run.messageType,
      step: requestedStep,
      contentText: this.getStepIntroText(requestedStep),
      contentJson: run.data
    });

    return {
      projectId,
      currentStep: projectCurrentStep,
      assistantMessage
    };
  }

  private resolveSkillForStep(step: WorkflowStep) {
    const mapping: Partial<Record<WorkflowStep, SkillName>> = {
      [WorkflowStep.SOP_GUIDE]: SkillName.SOP_GUIDE,
      [WorkflowStep.DATA_CLEANING]: SkillName.DATA_CLEANING,
      [WorkflowStep.DATA_CHECK]: SkillName.DATA_CHECK,
      [WorkflowStep.BASELINE_REGRESSION]: SkillName.BASELINE_REGRESSION,
      [WorkflowStep.ROBUSTNESS]: SkillName.ROBUSTNESS,
      [WorkflowStep.IV]: SkillName.IV,
      [WorkflowStep.MECHANISM]: SkillName.MECHANISM,
      [WorkflowStep.HETEROGENEITY]: SkillName.HETEROGENEITY
    };

    return mapping[step];
  }

  private buildSetupCollectionPrompt() {
    return {
      message:
        "请直接把面板数据研究设定告诉我，我会先整理成结构化摘要，再确认是否生成整套 Stata 工作流。DID 和 PSM 默认不做，只有您明确需要时我才会追问后续信息。",
      guidanceTitle: "建议至少包含这些信息",
      guidanceOptions: [
        ...REQUIRED_SETUP_FIELDS.map((item) => item.example),
        "可选：如果需要 DID，请说明处理组变量和政策年份；如果不需要，可以直接说不做 DID",
        "可选：如果需要 PSM，请说明处理变量和匹配变量；如果不需要，可以直接说不做 PSM",
        "可选：如果需要 IV，请提供真实工具变量；如果暂时没有，可以先不做 IV",
        "可选：如果已有机制变量或分组变量，也可以一起告诉我"
      ]
    };
  }

  private buildMissingFieldsNotice(
    draft: SetupDraft,
    missingFields: Array<{ key: SetupFieldKey; label: string; example: string }>,
    prefixMessage?: string
  ) {
    const intro = prefixMessage || "我已经先帮您整理出一版研究设定。为了直接生成整套 Stata 工作流，还需要您再补充以下信息：";
    const labels = missingFields.map((item) => item.label).join("、");

    return {
      message: `${intro}${labels}。`,
      reason: "研究设定尚未补齐。",
      guidanceTitle: "可以直接这样补充",
      guidanceOptions: missingFields.map((item) => item.example),
      currentDraft: this.buildSetupConfirmationContent(draft)
    };
  }

  private buildSetupConfirmationContent(draft: SetupDraft) {
    return {
      normalizedTopic: draft.normalizedTopic,
      independentVariable: draft.independentVariable,
      dependentVariable: draft.dependentVariable,
      researchObject: draft.researchObject,
      relationship: draft.relationship,
      controls: draft.controls,
      sampleScope: draft.sampleScope,
      fixedEffects: draft.fixedEffects,
      panelId: draft.panelId,
      timeVar: draft.timeVar,
      clusterVar: draft.clusterVar,
      analysisRoute: draft.analysisRoute,
      didEnabled: draft.didEnabled,
      psmEnabled: draft.psmEnabled,
      treatmentVar: draft.treatmentVar,
      policyTimeVar: draft.policyTimeVar,
      policyStartYear: draft.policyStartYear,
      instrumentVariable: draft.instrumentVariable,
      psmMatchVars: draft.psmMatchVars,
      mechanismVariables: draft.mechanismVariables,
      heterogeneityVars: draft.heterogeneityVars,
      exportFormats: draft.exportFormats,
      dataDictionary: draft.dataDictionary,
      confirmationMessage: "如无问题，请确认并直接生成整套 Stata 工作流。"
    };
  }

  private profileSnapshot(value: Record<string, unknown>) {
    return {
      normalizedTopic: value.normalizedTopic ?? "",
      independentVariable: value.independentVariable ?? "",
      dependentVariable: value.dependentVariable ?? "",
      researchObject: value.researchObject ?? "",
      controls: value.controls ?? [],
      sampleScope: value.sampleScope ?? null,
      fixedEffects: value.fixedEffects ?? [],
      panelId: value.panelId ?? null,
      timeVar: value.timeVar ?? null,
      clusterVar: value.clusterVar ?? null,
      didEnabled: value.didEnabled ?? false,
      psmEnabled: value.psmEnabled ?? false,
      treatmentVar: value.treatmentVar ?? null,
      policyTimeVar: value.policyTimeVar ?? null,
      policyStartYear: value.policyStartYear ?? null,
      instrumentVariable: value.instrumentVariable ?? null,
      psmMatchVars: value.psmMatchVars ?? [],
      mechanismVariables: value.mechanismVariables ?? [],
      heterogeneityVars: value.heterogeneityVars ?? [],
      exportFormats: value.exportFormats ?? [],
      dataDictionary: value.dataDictionary ?? []
    };
  }

  private getMissingSetupFields(draft: SetupDraft) {
    const missing = REQUIRED_SETUP_FIELDS.filter((field) => {
      const value = draft[field.key];
      if (Array.isArray(value)) {
        return value.length === 0;
      }
      return !String(value ?? "").trim();
    });

    if (draft.didEnabled) {
      if (!draft.treatmentVar) {
        missing.push({
          key: "treatmentVar",
          label: "DID处理组变量",
          example: "DID处理组变量：treat"
        });
      }
      if (!draft.policyStartYear) {
        missing.push({
          key: "policyStartYear",
          label: "DID政策年份",
          example: "DID政策年份：2015"
        });
      }
    }

    if (draft.psmEnabled) {
      if (!draft.treatmentVar) {
        missing.push({
          key: "treatmentVar",
          label: "PSM处理变量",
          example: "PSM处理变量：treat"
        });
      }
      if (draft.psmMatchVars.length === 0) {
        missing.push({
          key: "psmMatchVars",
          label: "PSM匹配变量",
          example: "PSM匹配变量：企业规模、资产负债率、ROA、成长性"
        });
      }
    }

    return missing;
  }

  private hasAnySetupContent(draft: SetupDraft) {
    return Boolean(
      draft.normalizedTopic ||
        draft.independentVariable ||
        draft.dependentVariable ||
        draft.researchObject ||
        draft.controls.length ||
        draft.sampleScope ||
        draft.fixedEffects.length ||
        draft.didEnabled ||
        draft.psmEnabled ||
        draft.instrumentVariable ||
        draft.psmMatchVars.length ||
        draft.mechanismVariables.length ||
        draft.heterogeneityVars.length ||
        draft.dataDictionary.length
    );
  }

  private inferTopicFromSentence(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return {
        independentVariable: "",
        dependentVariable: ""
      };
    }

    const match = trimmed.match(/^(.+?)(?:对|与|和)(.+?)(?:的)?(?:影响|效应|关系)(?:研究)?$/);
    if (!match) {
      return {
        independentVariable: "",
        dependentVariable: ""
      };
    }

    return {
      independentVariable: match[1]?.trim() ?? "",
      dependentVariable: match[2]?.trim() ?? ""
    };
  }

  private inferSampleScopeFromText(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }

    const match = trimmed.match(
      /(?:^|(?:样本|研究|数据|时间|年份|选择).{0,24})((?:19|20)\d{2})\s*年?\s*(?:-|~|～|〜|–|—|至|到)\s*((?:19|20)\d{2})\s*年?/i
    );
    if (!match) {
      return "";
    }

    return `${match[1]}–${match[2]}年`;
  }

  private shouldTryNormalizeTopic(userMessage: string, draft: SetupDraft) {
    if (draft.normalizedTopic && draft.independentVariable && draft.dependentVariable) {
      return false;
    }

    const trimmed = userMessage.trim();
    if (!trimmed || trimmed.length < 6) {
      return false;
    }

    return /研究|影响|效应|关系|解释变量|被解释变量|研究对象|样本|控制变量|固定效应|是否|对/.test(trimmed);
  }

  private normalizeResearchObjectDraft(value?: string | null) {
    const trimmed = value?.trim();
    if (!trimmed) {
      return "";
    }

    const normalized = trimmed.replace(/(?:中国)?A\s*股上市公司|(?:China\s+)?A-share listed firms/i, DEFAULT_RESEARCH_OBJECT);
    return normalized === "上市公司" || normalized === "企业" || normalized === "中国企业" || normalized === "中国上市公司"
      ? DEFAULT_RESEARCH_OBJECT
      : normalized;
  }

  private normalizeRelationshipLabel(value: string, normalizedTopic: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      return DEFAULT_RELATIONSHIP_LABEL;
    }

    if (/^(causal effect|因果影响)$/i.test(trimmed)) {
      return DEFAULT_RELATIONSHIP_LABEL;
    }

    if (normalizedTopic && trimmed === normalizedTopic) {
      return DEFAULT_RELATIONSHIP_LABEL;
    }

    if (/(对.+的影响|影响研究)$/i.test(trimmed)) {
      return DEFAULT_RELATIONSHIP_LABEL;
    }

    return DEFAULT_RELATIONSHIP_LABEL;
  }

  private hasSetupUpdates(payload: Record<string, unknown>) {
    return [
      "normalizedTopic",
      "independentVariable",
      "dependentVariable",
      "researchObject",
      "controls",
      "sampleScope",
      "fixedEffects",
      "clusterVar",
      "panelId",
      "timeVar",
      "analysisRoute",
      "didEnabled",
      "psmEnabled",
      "treatmentVar",
      "policyTimeVar",
      "policyStartYear",
      "instrumentVariable",
      "psmMatchVars",
      "mechanismVariables",
      "heterogeneityVars",
      "exportFormats",
      "notes",
      "dataDictionary"
    ].some((key) => {
      const value = payload[key];
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return typeof value === "string" ? value.trim().length > 0 : value != null;
    });
  }

  private isSetupStep(step: WorkflowStep) {
    return step === WorkflowStep.TOPIC_DETECT || step === WorkflowStep.TOPIC_NORMALIZE;
  }

  private isMeaninglessSetupInput(userMessage: string, draft: SetupDraft) {
    if (this.hasAnySetupContent(draft)) {
      return false;
    }

    const normalized = userMessage.trim().toLowerCase();
    return (
      /^(hi|hello|hey|ok|okay|yes|no|你好|您好|在吗|哈喽|嗨)$/.test(normalized) ||
      /搞鸡毛|搞什么|随便聊|闲聊/.test(userMessage) ||
      normalized.length <= 4
    );
  }

  private wantsRegenerateModule(userMessage: string) {
    return /重新生成|重跑|再来一版|再生成|给我代码|代码模板|stata代码|详细一点/.test(userMessage);
  }

  private wantsNext(userMessage: string) {
    return /^(继续|下一步|往下|继续推进|开始|继续生成|继续吧)$/i.test(userMessage.trim());
  }

  private isConfirmation(userMessage: string) {
    return /^(确认|确认主题|确认并生成|ok|okay|yes|可以|好的|没问题)$/i.test(userMessage.trim());
  }

  private looksLikeStataError(userMessage: string) {
    const text = userMessage.trim();
    if (!text) {
      return false;
    }

    return /r\(\d+\)|\b(error|invalid syntax|type mismatch|not found)\b|报错|错误|command .* (not found|unrecognized)|variable .* not found|no variables defined|option .* not allowed/i.test(
      text
    );
  }

  private looksLikeRegressionResult(userMessage: string) {
    return /coef\.|adj\s*r2|r-squared|observations|number of obs|t\s*=|p\s*</i.test(userMessage);
  }

  private booleanValue(value: unknown, fallback: boolean) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["1", "true", "yes", "y", "要", "做", "需要", "是"].includes(normalized)) {
        return true;
      }
      if (["0", "false", "no", "n", "不要", "不做", "不需要", "否"].includes(normalized)) {
        return false;
      }
    }
    return fallback;
  }

  private stringValue(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
  }

  private arrayValue(value: unknown) {
    if (!Array.isArray(value)) {
      return [] as string[];
    }

    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  private dataDictionaryValue(value: unknown) {
    if (!Array.isArray(value)) {
      return [] as DataDictionaryEntry[];
    }

    return value
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }

        const record = item as Record<string, unknown>;
        const variableName = this.stringValue(record.variableName);
        if (!variableName) {
          return null;
        }

        return {
          variableName,
          labelCn: this.stringValue(record.labelCn),
          description: this.stringValue(record.description),
          dataType: this.isDataDictionaryType(record.dataType) ? record.dataType : "unknown",
          candidateRole: this.isDataDictionaryRole(record.candidateRole) ? record.candidateRole : "unknown",
          aliases: this.arrayValue(record.aliases),
          source: this.stringValue(record.source),
          notes: this.stringValue(record.notes) || null,
          confidence: this.isConfidence(record.confidence) ? record.confidence : "medium"
        } satisfies DataDictionaryEntry;
      })
      .filter(Boolean) as DataDictionaryEntry[];
  }

  private isDataDictionaryType(value: unknown): value is DataDictionaryEntry["dataType"] {
    return value === "numeric" || value === "string" || value === "date" || value === "categorical" || value === "boolean" || value === "unknown";
  }

  private isDataDictionaryRole(value: unknown): value is DataDictionaryEntry["candidateRole"] {
    return (
      value === "dependent" ||
      value === "independent" ||
      value === "control" ||
      value === "fixed_effect" ||
      value === "cluster" ||
      value === "panel" ||
      value === "time" ||
      value === "treatment" ||
      value === "instrument" ||
      value === "mechanism" ||
      value === "heterogeneity" ||
      value === "match" ||
      value === "sample_filter" ||
      value === "unknown"
    );
  }

  private isConfidence(value: unknown): value is DataDictionaryEntry["confidence"] {
    return value === "high" || value === "medium" || value === "low";
  }

  private splitItems(value: string) {
    return value
      .replace(/[，、；;]/g, ",")
      .split(/[\s,\/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private normalizeExportFormats(values: string[]): ExportFormat[] {
    const normalized = new Set<ExportFormat>();
    for (const value of values) {
      const compact = value.toLowerCase().replace(/[\s_-]+/g, "");
      if (/word|docx|rtf|文档/.test(compact)) {
        normalized.add("word");
      }
      if (/latex|tex|overleaf/.test(compact)) {
        normalized.add("latex");
      }
      if (/excel|xlsx|表格/.test(compact)) {
        normalized.add("excel");
      }
      if (/stata|dofile|do文件|代码/.test(compact)) {
        normalized.add("stata_do");
      }
      if (EXPORT_FORMATS.has(value as ExportFormat)) {
        normalized.add(value as ExportFormat);
      }
    }
    return Array.from(normalized);
  }

  private isInvalidProfileString(value: string) {
    return /^(待补充|默认不做|不做|不需要|无需|默认|无|null|undefined)$/i.test(value.trim());
  }

  private cleanProfileValue(value: unknown) {
    if (value == null) {
      return undefined;
    }

    if (typeof value === "string") {
      const normalized = value.trim();
      return normalized && !this.isInvalidProfileString(normalized) ? normalized : undefined;
    }

    if (Array.isArray(value)) {
      const cleaned = Array.from(
        new Set(
          value
            .map((item) => String(item).trim())
            .filter((item) => item && !this.isInvalidProfileString(item))
        )
      );
      return cleaned.length > 0 ? cleaned : undefined;
    }

    return value;
  }

  private mergeModelFirstProfileUpdates(
    basePayload: Record<string, unknown>,
    deterministicUpdates: Record<string, unknown>,
    modelUpdates: Record<string, unknown>
  ) {
    // 研究设定抽取以大模型结构化结果为准；正则/文件解析只补模型漏掉的字段，不能再覆盖模型明确放入的位置。
    return {
      ...basePayload,
      ...deterministicUpdates,
      ...modelUpdates
    };
  }

  private applyMethodNegationCleanup(userMessage: string, payload: Record<string, unknown>) {
    const cleaned = { ...payload };
    const didDisabled = /(?:不做|暂时不做|先不做|不使用|不用|不需要|无需).{0,12}(?:DID|双重差分)/i.test(userMessage);
    const psmDisabled = /(?:不做|暂时不做|先不做|不使用|不用|不需要|无需).{0,12}(?:PSM|倾向得分匹配)/i.test(userMessage);
    const ivDisabled = /(?:不做|暂时不做|先不做|不使用|不用|不需要|无需).{0,12}(?:IV|工具变量|工具变量法)/i.test(userMessage);

    if (didDisabled) {
      cleaned.didEnabled = false;
      delete cleaned.policyTimeVar;
      delete cleaned.policyStartYear;
    }

    if (psmDisabled) {
      // 否定表达优先于关键词命中；出现“不做 PSM”时不能因为文本含 PSM 就启用匹配变量追问。
      cleaned.psmEnabled = false;
      delete cleaned.psmMatchVars;
    }

    if (didDisabled && psmDisabled) {
      delete cleaned.treatmentVar;
    }

    if (ivDisabled) {
      cleaned.instrumentVariable = null;
    }

    return cleaned;
  }

  private cleanProfileUpdatePayload(payload: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(payload)
        .map(([key, value]) => [key, this.cleanProfileValue(value)] as const)
        .filter(([, value]) => value !== undefined)
    );
  }

  private getStepIntroText(step: WorkflowStep) {
    const stepCopy: Partial<Record<WorkflowStep, string>> = {
      [WorkflowStep.SOP_GUIDE]: "我已经更新研究路径建议。",
      [WorkflowStep.DATA_CLEANING]: "我已经更新数据处理建议。",
      [WorkflowStep.DATA_CHECK]: "我已经更新数据检查建议。",
      [WorkflowStep.BASELINE_REGRESSION]: "我已经更新基准回归代码。",
      [WorkflowStep.ROBUSTNESS]: "我已经更新稳健性检验方案。",
      [WorkflowStep.IV]: "我已经更新内生性分析方案。",
      [WorkflowStep.MECHANISM]: "我已经更新机制分析方案。",
      [WorkflowStep.HETEROGENEITY]: "我已经更新异质性分析方案。"
    };

    return stepCopy[step] ?? "我已经更新当前模块内容。";
  }

  private async runSideSkill(
    projectId: string,
    currentStep: WorkflowStep,
    skillName:
      | typeof SkillName.GENERAL_RESEARCH_CHAT
      | typeof SkillName.RESULT_INTERPRET
      | typeof SkillName.STATA_ERROR_DEBUG,
    payload: Record<string, unknown>,
    projectCurrentStep: WorkflowStep,
    agentRunId?: string | null
  ) {
    const run = await this.skillsService.executeSkill({
      projectId,
      skillName,
      step: currentStep,
      payload,
      agentRunId
    });

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: run.messageType,
      step: currentStep,
      contentText:
        skillName === SkillName.RESULT_INTERPRET
          ? (run.data.plainExplanation as string)
          : skillName === SkillName.GENERAL_RESEARCH_CHAT
            ? (run.data.answer as string)
            : (run.data.explanation as string),
      contentJson: run.data
    });

    return { projectId, currentStep: projectCurrentStep, assistantMessage };
  }

  private async runSystemNotice(
    projectId: string,
    currentStep: WorkflowStep,
    payload: Record<string, unknown>
  ) {
    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: AssistantMessageType.SYSTEM_NOTICE,
      step: currentStep,
      contentText: typeof payload.message === "string" ? payload.message : "",
      contentJson: payload
    });

    return {
      projectId,
      currentStep,
      assistantMessage
    };
  }
}
