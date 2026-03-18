import { Injectable } from "@nestjs/common";
import {
  AssistantMessageType,
  ProjectStepStatus,
  SkillName,
  WorkflowStep
} from "@empirical/shared";
import { MessagesService } from "../messages/messages.service";
import { ProjectsService } from "../projects/projects.service";
import { ResearchProfileService } from "../research-profile/research-profile.service";
import { normalizeResearchObject } from "../skills/skill.utils";
import { SkillsService } from "../skills/skills.service";

@Injectable()
export class WorkflowService {
  private static readonly DEFAULT_RELATIONSHIP_LABEL =
    "\u6b63\u5411\u3001\u8d1f\u5411\u548c\u4e0d\u663e\u8457";

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
  }) {
    const project = await this.projectsService.assertProjectAccess(
      params.projectId,
      params.resumeToken
    );

    await this.messagesService.createMessage({
      projectId: params.projectId,
      role: "user",
      messageType: AssistantMessageType.SYSTEM_NOTICE,
      step: project.currentStep as WorkflowStep,
      contentText: params.userMessage,
      contentJson: {
        userMessage: params.userMessage,
        payload: params.payload ?? {}
      }
    });

    if (Object.keys(params.payload ?? {}).length > 0) {
      await this.researchProfileService.mergeExplicitUpdates(params.projectId, params.payload ?? {});
    }

    const currentStep = (params.requestedStep ?? project.currentStep) as WorkflowStep;

    if (this.looksLikeStataError(params.userMessage)) {
      return this.runSideSkill(
        params.projectId,
        currentStep,
        SkillName.STATA_ERROR_DEBUG,
        { userMessage: params.userMessage, ...params.payload }
      );
    }

    if (this.looksLikeRegressionResult(params.userMessage)) {
      return this.runSideSkill(
        params.projectId,
        currentStep,
        SkillName.RESULT_INTERPRET,
        {
          userMessage: params.userMessage,
          currentModule: project.currentStep,
          ...params.payload
        }
      );
    }

    const interpreter = await this.skillsService.executeSkill({
      projectId: params.projectId,
      skillName: SkillName.WORKFLOW_INPUT_INTERPRETER,
      step: currentStep,
      payload: {
        userMessage: params.userMessage,
        currentStep,
        currentModule: project.currentStep
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
      (typeof interpreter.data.normalizedUserMessage === "string" && interpreter.data.normalizedUserMessage.trim()) ||
      params.userMessage;

    if (interpreter.data.route === "ask_clarification") {
      return this.runSystemNotice(params.projectId, currentStep, {
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
        currentStep,
        SkillName.GENERAL_RESEARCH_CHAT,
        {
          userQuestion: effectiveUserMessage,
          currentModule: project.currentStep,
          ...effectivePayload
        }
      );
    }

    switch (currentStep) {
      case WorkflowStep.TOPIC_DETECT:
        return this.handleTopicEntry(params.projectId, effectiveUserMessage);
      case WorkflowStep.TOPIC_NORMALIZE:
        return this.handleTopicConfirmation(params.projectId, effectiveUserMessage, effectivePayload);
      case WorkflowStep.SOP_GUIDE:
        return this.handleSopGuide(params.projectId);
      case WorkflowStep.DATA_CLEANING:
        return this.handleDataCleaning(params.projectId, effectiveUserMessage, effectivePayload);
      case WorkflowStep.DATA_CHECK:
        return this.handleDataCheck(params.projectId, effectiveUserMessage, effectivePayload);
      case WorkflowStep.BASELINE_REGRESSION:
        return this.handleBaseline(params.projectId, effectivePayload);
      default:
        return this.runSystemNotice(params.projectId, currentStep, {
          message: "\u8fd9\u4e2a\u73af\u8282\u6682\u65f6\u8fd8\u5728\u8865\u5145\u4e2d\uff0c\u8bf7\u5148\u7ee7\u7eed\u5f53\u524d\u5df2\u5f00\u653e\u7684\u7814\u7a76\u6b65\u9aa4\u3002"
        });
    }
  }

  private async handleTopicEntry(projectId: string, userMessage: string) {
    const detect = await this.skillsService.executeSkill({
      projectId,
      skillName: SkillName.TOPIC_DETECT,
      step: WorkflowStep.TOPIC_DETECT,
      payload: { userInput: userMessage }
    });

    if (!detect.data.isValidTopic || detect.data.topicType === "not_topic") {
      return this.runSystemNotice(projectId, WorkflowStep.TOPIC_DETECT, detect.data);
    }

    const normalized = await this.skillsService.executeSkill({
      projectId,
      skillName: SkillName.TOPIC_NORMALIZE,
      step: WorkflowStep.TOPIC_DETECT,
      payload: { rawTopic: userMessage }
    });

    const normalizedData = {
      ...normalized.data,
      researchObject: normalizeResearchObject(normalized.data.researchObject),
      relationship: this.normalizeRelationshipLabel(
        normalized.data.relationship,
        normalized.data.normalizedTopic
      )
    };

    await this.projectsService.updateTopic(projectId, normalizedData.normalizedTopic);
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_DETECT, ProjectStepStatus.COMPLETED, {
      topicType: detect.data.topicType
    });
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_NORMALIZE, ProjectStepStatus.IN_PROGRESS, {});
    await this.projectsService.updateCurrentStep(projectId, WorkflowStep.TOPIC_NORMALIZE, SkillName.TOPIC_NORMALIZE);

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: normalized.messageType,
      step: WorkflowStep.TOPIC_NORMALIZE,
      contentText: normalizedData.confirmationMessage,
      contentJson: normalizedData
    });

    return {
      projectId,
      currentStep: WorkflowStep.TOPIC_NORMALIZE,
      assistantMessage
    };
  }

  private async handleTopicConfirmation(
    projectId: string,
    userMessage: string,
    payload: Record<string, unknown> = {}
  ) {
    if (!this.isConfirmation(userMessage)) {
      if (this.hasTopicConfirmationUpdates(payload)) {
        return this.handleTopicConfirmationUpdate(projectId, payload);
      }

      if (this.looksLikeTopicResetRequest(userMessage)) {
        const assistantMessage = await this.messagesService.createMessage({
          projectId,
          role: "assistant",
          messageType: AssistantMessageType.SYSTEM_NOTICE,
          step: WorkflowStep.TOPIC_NORMALIZE,
          contentText: "这个主题方向我先不直接往下推进。你可以告诉我想保留什么、想替换什么，我再帮你重新整理成新的研究设定。",
          contentJson: {
            reason: "用户否定了当前题目，但还没有提供新的明确方向。",
            guidanceTitle: "你可以这样告诉我",
            guidanceOptions: [
              "直接说你更想研究什么现象或结果",
              "例如：我更想研究金融监管对企业 ESG 的影响",
              "例如：把样本换成中国 A 股上市公司"
            ]
          }
        });

        return {
          projectId,
          currentStep: WorkflowStep.TOPIC_NORMALIZE,
          assistantMessage
        };
      }

      if (!this.looksLikeNewTopicCandidate(userMessage)) {
        return this.runSideSkill(
          projectId,
          WorkflowStep.TOPIC_NORMALIZE,
          SkillName.GENERAL_RESEARCH_CHAT,
          {
            userQuestion: userMessage,
            currentModule: WorkflowStep.TOPIC_NORMALIZE,
            ...payload
          }
        );
      }

      return this.handleTopicEntry(projectId, userMessage);
    }

    const messages = await this.messagesService.getRecentMessages(projectId);
    const latestConfirm = [...messages]
      .reverse()
      .find((message) => message.messageType === AssistantMessageType.TOPIC_CONFIRM);
    const content = (latestConfirm?.contentJson ?? {}) as Record<string, string>;

    await this.researchProfileService.initializeFromNormalization(projectId, {
      normalizedTopic: content.normalizedTopic ?? "",
      independentVariable: content.independentVariable ?? "",
      dependentVariable: content.dependentVariable ?? "",
      researchObject: normalizeResearchObject(content.researchObject),
      relationship: this.normalizeRelationshipLabel(content.relationship, content.normalizedTopic)
    });

    const sop = await this.skillsService.executeSkill({
      projectId,
      skillName: SkillName.SOP_GUIDE,
      step: WorkflowStep.SOP_GUIDE,
      payload: {
        normalizedTopic: content.normalizedTopic,
        researchObject: normalizeResearchObject(content.researchObject)
      }
    });

    await this.projectsService.updateStepStatus(projectId, WorkflowStep.TOPIC_NORMALIZE, ProjectStepStatus.COMPLETED, {});
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.SOP_GUIDE, ProjectStepStatus.IN_PROGRESS, {});
    await this.projectsService.updateCurrentStep(projectId, WorkflowStep.SOP_GUIDE, SkillName.SOP_GUIDE);

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: sop.messageType,
      step: WorkflowStep.SOP_GUIDE,
      contentText: sop.data.message,
      contentJson: sop.data
    });

    return {
      projectId,
      currentStep: WorkflowStep.SOP_GUIDE,
      assistantMessage
    };
  }

  private async handleSopGuide(projectId: string) {
    const run = await this.skillsService.executeSkill({
      projectId,
      skillName: SkillName.DATA_CLEANING,
      step: WorkflowStep.DATA_CLEANING,
      payload: {}
    });

    await this.projectsService.updateStepStatus(projectId, WorkflowStep.SOP_GUIDE, ProjectStepStatus.COMPLETED, {});
    await this.projectsService.updateStepStatus(projectId, WorkflowStep.DATA_CLEANING, ProjectStepStatus.IN_PROGRESS, {});
    await this.projectsService.updateCurrentStep(projectId, WorkflowStep.DATA_CLEANING, SkillName.DATA_CLEANING);

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: run.messageType,
      step: WorkflowStep.DATA_CLEANING,
      contentText: "已进入数据清洗阶段。",
      contentJson: run.data
    });

    return { projectId, currentStep: WorkflowStep.DATA_CLEANING, assistantMessage };
  }

  private async handleDataCleaning(
    projectId: string,
    userMessage: string,
    payload: Record<string, unknown>
  ) {
    if (this.wantsNext(userMessage) || this.wantsDataCheck(userMessage)) {
      const run = await this.skillsService.executeSkill({
        projectId,
        skillName: SkillName.DATA_CHECK,
        step: WorkflowStep.DATA_CHECK,
        payload
      });

      await this.projectsService.updateStepStatus(projectId, WorkflowStep.DATA_CLEANING, ProjectStepStatus.COMPLETED, {});
      await this.projectsService.updateStepStatus(projectId, WorkflowStep.DATA_CHECK, ProjectStepStatus.IN_PROGRESS, {});
      await this.projectsService.updateCurrentStep(projectId, WorkflowStep.DATA_CHECK, SkillName.DATA_CHECK);

      const assistantMessage = await this.messagesService.createMessage({
        projectId,
        role: "assistant",
        messageType: run.messageType,
        step: WorkflowStep.DATA_CHECK,
        contentText: "已进入数据检查阶段。",
        contentJson: run.data
      });

      return { projectId, currentStep: WorkflowStep.DATA_CHECK, assistantMessage };
    }

    const run = await this.skillsService.executeSkill({
      projectId,
      skillName: SkillName.DATA_CLEANING,
      step: WorkflowStep.DATA_CLEANING,
      payload
    });

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: run.messageType,
      step: WorkflowStep.DATA_CLEANING,
      contentText: "已更新数据清洗建议。",
      contentJson: run.data
    });

    return { projectId, currentStep: WorkflowStep.DATA_CLEANING, assistantMessage };
  }

  private async handleDataCheck(
    projectId: string,
    userMessage: string,
    payload: Record<string, unknown>
  ) {
    if (this.wantsNext(userMessage) || this.wantsBaseline(userMessage)) {
      const run = await this.skillsService.executeSkill({
        projectId,
        skillName: SkillName.BASELINE_REGRESSION,
        step: WorkflowStep.BASELINE_REGRESSION,
        payload
      });

      await this.projectsService.updateStepStatus(projectId, WorkflowStep.DATA_CHECK, ProjectStepStatus.COMPLETED, {});
      await this.projectsService.updateStepStatus(projectId, WorkflowStep.BASELINE_REGRESSION, ProjectStepStatus.IN_PROGRESS, {});
      await this.projectsService.updateCurrentStep(projectId, WorkflowStep.BASELINE_REGRESSION, SkillName.BASELINE_REGRESSION);

      const assistantMessage = await this.messagesService.createMessage({
        projectId,
        role: "assistant",
        messageType: run.messageType,
        step: WorkflowStep.BASELINE_REGRESSION,
        contentText: "已进入基准回归阶段。",
        contentJson: run.data
      });

      return { projectId, currentStep: WorkflowStep.BASELINE_REGRESSION, assistantMessage };
    }

    const run = await this.skillsService.executeSkill({
      projectId,
      skillName: SkillName.DATA_CHECK,
      step: WorkflowStep.DATA_CHECK,
      payload
    });

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: run.messageType,
      step: WorkflowStep.DATA_CHECK,
      contentText: "已更新数据检查建议。",
      contentJson: run.data
    });

    return { projectId, currentStep: WorkflowStep.DATA_CHECK, assistantMessage };
  }

  private async handleBaseline(projectId: string, payload: Record<string, unknown>) {
    const run = await this.skillsService.executeSkill({
      projectId,
      skillName: SkillName.BASELINE_REGRESSION,
      step: WorkflowStep.BASELINE_REGRESSION,
      payload
    });

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: run.messageType,
      step: WorkflowStep.BASELINE_REGRESSION,
      contentText: "已更新基准回归建议。",
      contentJson: run.data
    });

    return { projectId, currentStep: WorkflowStep.BASELINE_REGRESSION, assistantMessage };
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

  private hasTopicConfirmationUpdates(payload: Record<string, unknown>) {
    return ["normalizedTopic", "independentVariable", "dependentVariable", "researchObject", "relationship"].some(
      (key) => {
        const value = payload[key];
        return typeof value === "string" && value.trim().length > 0;
      }
    );
  }

  private buildTopicTitle(independentVariable: string, dependentVariable: string, fallback: string) {
    if (independentVariable && dependentVariable) {
      return `${independentVariable}对${dependentVariable}的影响研究`;
    }

    return fallback;
  }

  private async handleTopicConfirmationUpdate(projectId: string, payload: Record<string, unknown>) {
    const messages = await this.messagesService.getRecentMessages(projectId);
    const latestConfirm = [...messages]
      .reverse()
      .find((message) => message.messageType === AssistantMessageType.TOPIC_CONFIRM);

    const previous = (latestConfirm?.contentJson ?? {}) as Record<string, string>;
    if (!previous.normalizedTopic && typeof payload.normalizedTopic !== "string") {
      return this.runSystemNotice(projectId, WorkflowStep.TOPIC_NORMALIZE, {
        message: "当前还没有可修改的研究设定，请先生成一次题目标准化结果。"
      });
    }

    const independentVariable =
      (typeof payload.independentVariable === "string" && payload.independentVariable.trim()) ||
      previous.independentVariable ||
      "";
    const dependentVariable =
      (typeof payload.dependentVariable === "string" && payload.dependentVariable.trim()) ||
      previous.dependentVariable ||
      "";
    const researchObject = normalizeResearchObject(
      (typeof payload.researchObject === "string" && payload.researchObject.trim()) || previous.researchObject || ""
    );
    const normalizedTopic =
      (typeof payload.normalizedTopic === "string" && payload.normalizedTopic.trim()) ||
      this.buildTopicTitle(independentVariable, dependentVariable, previous.normalizedTopic || "");
    const relationship = this.normalizeRelationshipLabel(
      (typeof payload.relationship === "string" && payload.relationship.trim()) || previous.relationship,
      normalizedTopic
    );

    await this.projectsService.updateTopic(projectId, normalizedTopic);

    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "assistant",
      messageType: AssistantMessageType.TOPIC_CONFIRM,
      step: WorkflowStep.TOPIC_NORMALIZE,
      contentText: "已根据你的反馈更新研究设定。",
      contentJson: {
        normalizedTopic,
        independentVariable,
        dependentVariable,
        researchObject,
        relationship,
        confirmationMessage: "请确认是否采用这个版本的研究设定。",
        candidateTopics: [normalizedTopic].filter(Boolean)
      }
    });

    return {
      projectId,
      currentStep: WorkflowStep.TOPIC_NORMALIZE,
      assistantMessage
    };
  }

  private async runSideSkill(
    projectId: string,
    currentStep: WorkflowStep,
    skillName:
      | typeof SkillName.GENERAL_RESEARCH_CHAT
      | typeof SkillName.RESULT_INTERPRET
      | typeof SkillName.STATA_ERROR_DEBUG,
    payload: Record<string, unknown>
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

    return { projectId, currentStep, assistantMessage };
  }

  private async runSystemNotice(
    projectId: string,
    currentStep: WorkflowStep,
    payload: Record<string, unknown>
  ) {
    const assistantMessage = await this.messagesService.createMessage({
      projectId,
      role: "system",
      messageType: AssistantMessageType.SYSTEM_NOTICE,
      step: currentStep,
      contentText: (payload.message as string) ?? (payload.reason as string) ?? "系统提示",
      contentJson: payload
    });

    return { projectId, currentStep, assistantMessage };
  }

  private shouldRouteToGeneralResearchChat(text: string, currentStep: WorkflowStep) {
    if (currentStep === WorkflowStep.TOPIC_DETECT) {
      return false;
    }

    if (this.isConfirmation(text) || this.wantsNext(text) || this.wantsDataCheck(text) || this.wantsBaseline(text)) {
      return false;
    }

    if (currentStep === WorkflowStep.TOPIC_NORMALIZE && this.looksLikeTopicRevision(text)) {
      return false;
    }

    return this.looksLikeResearchQuestion(text);
  }

  private looksLikeResearchQuestion(text: string) {
    return /[?？]|^(什么|为什么|如何|怎么|是否|可否|能否|请问|解释|请解释|帮我解释|我想问|想问|如果|区别)/i.test(text) || /(什么意思|为什么|怎么|如何|区别|逻辑|文献|理论|机制|指标|变量构建|固定效应|稳健性|内生性|控制变量|中介效应|异质性)/i.test(text);
  }

  private looksLikeTopicRevision(text: string) {
    return /(\u6539\u6210|\u6539\u4e3a|\u6362\u6210|\u4fee\u6539|\u8865\u5145|\u7814\u7a76\u5bf9\u8c61|\u89e3\u91ca\u53d8\u91cf|\u88ab\u89e3\u91ca\u53d8\u91cf|\u5173\u7cfb\u7c7b\u578b|\u9898\u76ee|\u4e3b\u9898)/i.test(text);
  }

  private looksLikeNewTopicCandidate(text: string) {
    return /(\u5bf9|\u4e0e|\u5f71\u54cd|\u6548\u5e94|\u5173\u7cfb|\u662f\u5426|\u4f5c\u7528\u4e8e|impact|effect|relation)/i.test(text)
      && text.trim().length >= 6;
  }

  private normalizeRelationshipLabel(value: string | undefined, normalizedTopic?: string) {
    const trimmed = typeof value === "string" ? value.trim() : "";

    if (!trimmed) {
      return WorkflowService.DEFAULT_RELATIONSHIP_LABEL;
    }

    if (/^(causal effect|\u56e0\u679c\u5f71\u54cd)$/i.test(trimmed)) {
      return WorkflowService.DEFAULT_RELATIONSHIP_LABEL;
    }

    if (normalizedTopic && trimmed === normalizedTopic.trim()) {
      return WorkflowService.DEFAULT_RELATIONSHIP_LABEL;
    }

    if (/(\u5bf9.+\u7684\u5f71\u54cd|\u5f71\u54cd\u7814\u7a76)$/i.test(trimmed)) {
      return WorkflowService.DEFAULT_RELATIONSHIP_LABEL;
    }

    return trimmed;
  }

  private looksLikeTopicResetRequest(text: string) {
    return /(\u6362\u4e00\u4e2a|\u6362\u4e2a|\u91cd\u65b0\u6765|\u91cd\u6765|\u91cd\u5199|\u91cd\u505a|\u53e6\u4e00\u4e2a|\u4e0d\u884c|\u4e0d\u592a\u884c|\u4e0d\u5408\u9002|\u91cd\u65b0\u9009\u9898|\u91cd\u65b0\u6362\u9898)/i.test(text) && !this.looksLikeTopicCandidate(text);
  }

  private looksLikeTopicCandidate(text: string) {
    return /(对|与|影响|效应|关系|是否|提升|抑制|作用于|impact|effect|relation)/i.test(text) && text.trim().length >= 6;
  }

  private isConfirmation(text: string) {
    const normalized = text
      .trim()
      .toLowerCase()
      .replace(/[\s,，。.!！?？；;、]/g, "");

    return [
      "yes",
      "ok",
      "okay",
      "confirm",
      "confirmed",
      "start",
      "continue",
      "go",
      "yescontinue",
      "是",
      "是的",
      "好",
      "好的",
      "确认",
      "确认主题",
      "继续",
      "是的继续",
      "好的继续",
      "继续进入后续流程",
      "进入下一步"
    ].includes(normalized);
  }

  private wantsNext(text: string) {
    return /(next|continue|start|go|\u4e0b\u4e00\u6b65|\u7ee7\u7eed|\u5f00\u59cb)/i.test(text);
  }

  private wantsDataCheck(text: string) {
    return /(data check|describe|summarize|\u6570\u636e\u68c0\u67e5)/i.test(text);
  }

  private wantsBaseline(text: string) {
    return /(baseline|regression|reghdfe|\u57fa\u51c6\u56de\u5f52|\u56de\u5f52)/i.test(text);
  }

  private looksLikeStataError(text: string) {
    return /(not found|invalid syntax|error|r\(\d+\)|\u62a5\u9519|\u627e\u4e0d\u5230)/i.test(text);
  }

  private looksLikeRegressionResult(text: string) {
    return /(R.?2|Adj|coef\.|t\)|P>|\*\*\*|Number of obs|reghdfe)/i.test(text);
  }
}


