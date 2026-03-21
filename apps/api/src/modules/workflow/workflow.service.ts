import { Injectable } from "@nestjs/common";
import {
  AssistantMessageType,
  ProjectStepStatus,
  SkillName,
  WorkflowStep,
  type ResearchProfile,
  type WorkflowProgressPayload
} from "@empirical/shared";
import { MessagesService } from "../messages/messages.service";
import { ProjectsService } from "../projects/projects.service";
import { ResearchProfileService } from "../research-profile/research-profile.service";
import { SkillsService } from "../skills/skills.service";

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
  notes: string;
};

type SetupFieldKey =
  | "normalizedTopic"
  | "researchObject"
  | "independentVariable"
  | "dependentVariable"
  | "controls"
  | "sampleScope"
  | "fixedEffects";

type WorkflowRunEntry = {
  step: WorkflowStep;
  skillName: SkillName;
  contentText: string;
};

const DEFAULT_RELATIONSHIP_LABEL = "正向、负向和不显著";
const DEFAULT_RESEARCH_OBJECT = "中国A股上市公司";

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


const WORKFLOW_PROGRESS_BY_STEP: Partial<
  Record<WorkflowStep, { currentCount: number; stageLabel: string }>
> = {
  [WorkflowStep.DATA_CHECK]: {
    currentCount: 2,
    stageLabel: "数据处理"
  },
  [WorkflowStep.BASELINE_REGRESSION]: {
    currentCount: 3,
    stageLabel: "基准回归"
  },
  [WorkflowStep.ROBUSTNESS]: {
    currentCount: 4,
    stageLabel: "稳健性检验"
  },
  [WorkflowStep.IV]: {
    currentCount: 5,
    stageLabel: "内生性分析"
  },
  [WorkflowStep.MECHANISM]: {
    currentCount: 6,
    stageLabel: "机制分析"
  },
  [WorkflowStep.HETEROGENEITY]: {
    currentCount: 7,
    stageLabel: "异质性分析"
  }
};

const TOTAL_WORKFLOW_STAGE_COUNT = 7;

@Injectable()
export class WorkflowService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly messagesService: MessagesService,
    private readonly researchProfileService: ResearchProfileService,
    private readonly skillsService: SkillsService
  ) {}

  async handleNext(params: {
    projectId: string;
    resumeToken?: string;
    userMessage: string;
    requestedStep?: WorkflowStep;
    payload?: Record<string, unknown>;
    onProgress?: (progress: WorkflowProgressPayload) => void | Promise<void>;
  }) {
    const project = await this.projectsService.assertProjectAccess(
      params.projectId,
      params.resumeToken
    );

    const requestedStep = (params.requestedStep ?? project.currentStep) as WorkflowStep;

    await this.messagesService.createMessage({
      projectId: params.projectId,
      role: "user",
      messageType: AssistantMessageType.SYSTEM_NOTICE,
      step: requestedStep,
      contentText: params.userMessage,
      contentJson: {
        userMessage: params.userMessage,
        payload: params.payload ?? {},
        requestedStep
      }
    });

    if (Object.keys(params.payload ?? {}).length > 0) {
      await this.researchProfileService.mergeExplicitUpdates(params.projectId, params.payload ?? {});
    }

    if (this.looksLikeStataError(params.userMessage)) {
      return this.runSideSkill(
        params.projectId,
        requestedStep,
        SkillName.STATA_ERROR_DEBUG,
        { userMessage: params.userMessage, ...params.payload },
        project.currentStep as WorkflowStep
      );
    }

    if (this.looksLikeRegressionResult(params.userMessage)) {
      return this.runSideSkill(
        params.projectId,
        requestedStep,
        SkillName.RESULT_INTERPRET,
        {
          userMessage: params.userMessage,
          currentModule: requestedStep,
          ...params.payload
        },
        project.currentStep as WorkflowStep
      );
    }

    const interpreter = await this.skillsService.executeSkill({
      projectId: params.projectId,
      skillName: SkillName.WORKFLOW_INPUT_INTERPRETER,
      step: requestedStep,
      payload: {
        userMessage: params.userMessage,
        currentStep: requestedStep,
        currentModule: requestedStep
      }
    });

    const interpretedUpdates = this.cleanProfileUpdatePayload(
      (interpreter.data.profileUpdates as Record<string, unknown> | undefined) ?? {}
    );
    if (Object.keys(interpretedUpdates).length > 0) {
      await this.researchProfileService.mergeExplicitUpdates(params.projectId, interpretedUpdates);
    }

    const effectivePayload = {
      ...(params.payload ?? {}),
      ...interpretedUpdates
    };
    const effectiveUserMessage =
      (typeof interpreter.data.normalizedUserMessage === "string" &&
        interpreter.data.normalizedUserMessage.trim()) || params.userMessage;

    if (!this.isSetupStep(requestedStep) && this.hasSetupUpdates(effectivePayload)) {
      return this.resetToSetupConfirmation(
        params.projectId,
        effectiveUserMessage,
        effectivePayload,
        "研究设定已变化。我先帮您更新摘要，确认后会重新生成整套 Stata 工作流。"
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
        project.currentStep as WorkflowStep
      );
    }

    if (this.isSetupStep(requestedStep)) {
      return this.handleSetupCollection(
        params.projectId,
        effectiveUserMessage,
        effectivePayload,
        this.isConfirmation(effectiveUserMessage),
        params.onProgress
      );
    }

    return this.handleGeneratedModuleInput(
      params.projectId,
      requestedStep,
      effectiveUserMessage,
      effectivePayload,
      project.currentStep as WorkflowStep
    );
  }

  private async handleSetupCollection(
    projectId: string,
    userMessage: string,
    payload: Record<string, unknown>,
    confirmed: boolean,
    onProgress?: (progress: WorkflowProgressPayload) => void | Promise<void>
  ) {
    const draft = await this.buildSetupDraft(projectId, userMessage, payload);
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
      await this.clearSetupAssistantMessages(projectId);
      return this.runSystemNotice(projectId, WorkflowStep.TOPIC_NORMALIZE, this.buildSetupCollectionPrompt());
    }

    await this.persistSetupDraft(projectId, draft);

    if (missingFields.length > 0) {
      await this.clearSetupAssistantMessages(projectId);

      if (confirmed) {
        return this.runSystemNotice(projectId, WorkflowStep.TOPIC_NORMALIZE, this.buildMissingFieldsNotice(draft, missingFields));
      }

      return this.runSystemNotice(projectId, WorkflowStep.TOPIC_NORMALIZE, this.buildMissingFieldsNotice(draft, missingFields));
    }

    if (!confirmed) {
      await this.clearSetupAssistantMessages(projectId);
      const assistantMessage = await this.messagesService.createMessage({
        projectId,
        role: "assistant",
        messageType: AssistantMessageType.TOPIC_CONFIRM,
        step: WorkflowStep.TOPIC_NORMALIZE,
        contentText: "我已经整理好一版研究设定。确认后我会一次性生成完整的 Stata 工作流。",
        contentJson: this.buildSetupConfirmationContent(draft)
      });

      return {
        projectId,
        currentStep: WorkflowStep.TOPIC_NORMALIZE,
        assistantMessage
      };
    }

    await this.researchProfileService.mergeExplicitUpdates(projectId, draft as unknown as Partial<ResearchProfile>);
    const primaryMessage = await this.runFullWorkflowGeneration(projectId, draft, onProgress);

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
    projectCurrentStep: WorkflowStep
  ) {
    if (this.wantsRegenerateModule(userMessage)) {
      return this.runModuleSkill(projectId, requestedStep, payload, projectCurrentStep);
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
      projectCurrentStep
    );
  }

  private async resetToSetupConfirmation(
    projectId: string,
    userMessage: string,
    payload: Record<string, unknown>,
    message: string
  ) {
    const draft = await this.buildSetupDraft(projectId, userMessage, payload);
    await this.persistSetupDraft(projectId, draft);
    await this.resetGeneratedSteps(projectId);
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_DETECT, ProjectStepStatus.COMPLETED, {});
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_NORMALIZE, ProjectStepStatus.IN_PROGRESS, {});
    await this.projectsService.updateCurrentStep(projectId, WorkflowStep.TOPIC_NORMALIZE, SkillName.TOPIC_NORMALIZE);

    const missingFields = this.getMissingSetupFields(draft);
    await this.clearSetupAssistantMessages(projectId);

    if (missingFields.length > 0) {
      return this.runSystemNotice(projectId, WorkflowStep.TOPIC_NORMALIZE, this.buildMissingFieldsNotice(draft, missingFields, message));
    }

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: AssistantMessageType.TOPIC_CONFIRM,
      step: WorkflowStep.TOPIC_NORMALIZE,
      contentText: message,
      contentJson: this.buildSetupConfirmationContent(draft)
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
    payload: Record<string, unknown>
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
      fixedEffects:
        this.arrayValue(payload.fixedEffects).length > 0 ? this.arrayValue(payload.fixedEffects) : stored?.fixedEffects ?? [],
      sampleScope: this.stringValue(payload.sampleScope) || stored?.sampleScope || "",
      clusterVar: this.stringValue(payload.clusterVar) || stored?.clusterVar || "",
      panelId: this.stringValue(payload.panelId) || stored?.panelId || "",
      timeVar: this.stringValue(payload.timeVar) || stored?.timeVar || "",
      notes: this.stringValue(payload.notes) || stored?.notes || ""
    };

    if (draft.controls.length === 0 && typeof payload.controls === "string") {
      draft.controls = this.splitItems(String(payload.controls));
    }
    if (draft.fixedEffects.length === 0 && typeof payload.fixedEffects === "string") {
      draft.fixedEffects = this.splitItems(String(payload.fixedEffects));
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
          }
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
      clusterVar: draft.clusterVar || null,
      panelId: draft.panelId || null,
      timeVar: draft.timeVar || null,
      notes: draft.notes || null
    });

    if (draft.normalizedTopic) {
      await this.projectsService.updateTopic(projectId, draft.normalizedTopic);
    }
  }

  private async runFullWorkflowGeneration(
    projectId: string,
    draft: SetupDraft,
    onProgress?: (progress: WorkflowProgressPayload) => void | Promise<void>
  ) {
    await this.resetGeneratedSteps(projectId);
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_DETECT, ProjectStepStatus.COMPLETED, {});
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_NORMALIZE, ProjectStepStatus.COMPLETED, {});

    let primaryMessage = null as Awaited<ReturnType<MessagesService["createMessage"]>> | null;

    for (const entry of GENERATED_WORKFLOW) {
      await this.projectsService.updateStepStatus(projectId, entry.step, ProjectStepStatus.IN_PROGRESS, { generatedInBatch: true });

      const run = await this.skillsService.executeSkill({
        projectId,
        skillName: entry.skillName,
        step: entry.step,
        payload: {
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
          notes: draft.notes || undefined
        }
      });

      const assistantMessage = await this.messagesService.createMessage({
        projectId,
        role: "assistant",
        messageType: run.messageType,
        step: entry.step,
        contentText: entry.contentText,
        contentJson: run.data
      });

      await this.projectsService.updateStepStatus(projectId, entry.step, ProjectStepStatus.COMPLETED, { generatedInBatch: true });

      const progressMeta = WORKFLOW_PROGRESS_BY_STEP[entry.step];
      if (progressMeta && onProgress) {
        const remainingStages = Math.max(0, TOTAL_WORKFLOW_STAGE_COUNT - progressMeta.currentCount);
        await onProgress({
          currentCount: progressMeta.currentCount,
          totalCount: TOTAL_WORKFLOW_STAGE_COUNT,
          stageLabel: progressMeta.stageLabel,
          remainingMinutes: remainingStages === 0 ? 0 : Math.max(1, Math.ceil(remainingStages * 0.8))
        });
      }

      if (entry.step === WorkflowStep.DATA_CLEANING) {
        primaryMessage = assistantMessage;
      }
    }

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
    projectCurrentStep: WorkflowStep
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
      payload
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
        "请直接把研究设定告诉我，我会先帮您整理成结构化摘要，再确认是否生成整套 Stata 工作流。",
      guidanceTitle: "建议至少包含这些信息",
      guidanceOptions: REQUIRED_SETUP_FIELDS.map((item) => item.example)
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
      confirmationMessage: "如无问题，请确认并直接生成整套 Stata 工作流。"
    };
  }

  private getMissingSetupFields(draft: SetupDraft) {
    return REQUIRED_SETUP_FIELDS.filter((field) => {
      const value = draft[field.key];
      if (Array.isArray(value)) {
        return value.length === 0;
      }
      return !String(value ?? "").trim();
    });
  }

  private hasAnySetupContent(draft: SetupDraft) {
    return Boolean(
      draft.normalizedTopic ||
        draft.independentVariable ||
        draft.dependentVariable ||
        draft.researchObject ||
        draft.controls.length ||
        draft.sampleScope ||
        draft.fixedEffects.length
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

    const normalized = trimmed.replace(/A股上市公司|A 股上市公司|A-share listed firms/i, DEFAULT_RESEARCH_OBJECT);
    return normalized === "上市公司" || normalized === "企业" || normalized === "中国企业"
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
      "notes"
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
    return /r\(\d+\)|not found|invalid syntax|command .* not found|type mismatch|variable .* not found|stata/i.test(
      userMessage
    );
  }

  private looksLikeRegressionResult(userMessage: string) {
    return /coef\.|adj\s*r2|r-squared|observations|number of obs|t\s*=|p\s*</i.test(userMessage);
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

  private splitItems(value: string) {
    return value
      .replace(/[，、；;]/g, ",")
      .split(/[\s,\/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private cleanProfileUpdatePayload(payload: Record<string, unknown>) {
    return Object.fromEntries(
      Object.entries(payload).filter(([, value]) => {
        if (value == null) {
          return false;
        }
        if (typeof value === "string") {
          return value.trim().length > 0;
        }
        if (Array.isArray(value)) {
          return value.length > 0;
        }
        return true;
      })
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
    projectCurrentStep: WorkflowStep
  ) {
    const run = await this.skillsService.executeSkill({
      projectId,
      skillName,
      step: currentStep,
      payload
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

