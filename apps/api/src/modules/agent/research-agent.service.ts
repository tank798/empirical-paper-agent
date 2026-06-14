import { Injectable } from "@nestjs/common";
import {
  AssistantMessageType,
  WorkflowStep,
  type WorkflowProgressPayload
} from "@empirical/shared";
import {
  LlmService,
  type LlmChatMessage,
  type LlmFunctionTool,
  type LlmToolCall
} from "../llm/llm.service";
import { PromptService } from "../prompt/prompt.service";
import { ProjectsService } from "../projects/projects.service";
import { MessagesService } from "../messages/messages.service";
import { ResearchProfileService } from "../research-profile/research-profile.service";
import { HarnessService } from "../harness/harness.service";
import { inferProfileUpdates } from "../skills/skill.utils";
import { WorkflowService } from "../workflow/workflow.service";
import { InputSourceService } from "./input-source.service";
import { HISTORY_MESSAGE_LIMIT, trimHeadTail } from "./input-source.utils";

type AgentPhase = "research_setup" | "workflow_ready";

type AgentToolExecution = {
  name: string;
  ok: boolean;
  result: Record<string, unknown>;
};

const PROFILE_UPDATE_PROPERTIES = {
  normalizedTopic: { type: "string", description: "40字以内的规范化研究主题" },
  independentVariable: { type: "string", description: "核心解释变量" },
  dependentVariable: { type: "string", description: "被解释变量" },
  researchObject: { type: "string", description: "研究对象或样本对象" },
  relationship: { type: "string", description: "理论关系描述" },
  controls: { type: "array", items: { type: "string" }, description: "完整控制变量列表" },
  fixedEffects: { type: "array", items: { type: "string" }, description: "完整固定效应列表" },
  clusterVar: { type: "string", description: "真实聚类字段名" },
  panelId: { type: "string", description: "真实面板个体字段名" },
  timeVar: { type: "string", description: "真实时间字段名" },
  sampleScope: { type: "string", description: "样本范围，例如 2009–2023年" },
  analysisRoute: { type: "string", enum: ["panel_fe"] },
  didEnabled: { type: "boolean" },
  psmEnabled: { type: "boolean" },
  treatmentVar: { type: "string" },
  policyTimeVar: { type: "string" },
  policyStartYear: { type: "string" },
  instrumentVariable: { type: "string" },
  psmMatchVars: { type: "array", items: { type: "string" } },
  mechanismVariables: { type: "array", items: { type: "string" } },
  heterogeneityVars: { type: "array", items: { type: "string" } },
  exportFormats: {
    type: "array",
    items: { type: "string", enum: ["word", "latex", "excel", "stata_do"] }
  },
  notes: { type: "string" },
  dataDictionary: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: {
        variableName: { type: "string" },
        labelCn: { type: "string" },
        description: { type: "string" },
        dataType: {
          type: "string",
          enum: ["numeric", "string", "date", "categorical", "boolean", "unknown"]
        },
        candidateRole: {
          type: "string",
          enum: [
            "dependent",
            "independent",
            "control",
            "fixed_effect",
            "cluster",
            "panel",
            "time",
            "treatment",
            "instrument",
            "mechanism",
            "heterogeneity",
            "match",
            "sample_filter",
            "unknown"
          ]
        },
        aliases: { type: "array", items: { type: "string" } },
        source: { type: "string" },
        notes: { type: "string" },
        confidence: { type: "string", enum: ["high", "medium", "low"] }
      },
      required: ["variableName"]
    }
  }
} as const;

const CLEARABLE_PROFILE_FIELDS = [
  "normalizedTopic",
  "independentVariable",
  "dependentVariable",
  "researchObject",
  "relationship",
  "controls",
  "fixedEffects",
  "clusterVar",
  "panelId",
  "timeVar",
  "sampleScope",
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
] as const;

export const RESEARCH_AGENT_TOOLS: LlmFunctionTool[] = [
  {
    type: "function",
    function: {
      name: "recall_sources",
      description:
        "只读回看历史输入源。当当前问题依赖此前上传/粘贴的材料，且当前研究设定和短历史不足以回答或更新设定时调用。不要因为出现'之前/刚才/附件'等词机械调用，需要结合语义判断。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          sourceIds: {
            type: "array",
            items: { type: "string" },
            description: "可选。历史输入源索引中的 sourceId 或 artifactId；不填则回看最近输入源。"
          },
          query: {
            type: "string",
            description: "用于召回片段的查询词，例如：变量定义 模型设定 样本区间。"
          },
          maxChunks: {
            type: "number",
            description: "每个长文本源最多返回多少个片段，默认8，最大20。"
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_research_profile",
      description:
        "仅在用户明确提供、补充、替换或清空研究设定时调用。profileUpdates只放本轮明确变化；本轮未提到的字段不要填写。用户明确删除或不再使用的字段放入clearFields。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          profileUpdates: {
            type: "object",
            additionalProperties: false,
            properties: PROFILE_UPDATE_PROPERTIES
          },
          clearFields: {
            type: "array",
            items: { type: "string", enum: CLEARABLE_PROFILE_FIELDS }
          },
          reason: { type: "string" }
        },
        required: ["profileUpdates"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "validate_research_setup",
      description: "只读校验当前研究设定是否足以生成完整工作流。不要用它回答普通问题。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "generate_workflow",
      description: "仅在用户明确确认或要求生成完整Stata工作流时调用。工作流由确定性规则生成，不调用LLM。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          reason: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "regenerate_workflow_module",
      description: "仅在用户明确要求重新生成某个已有工作流模块时调用。模块由确定性规则生成，不调用LLM。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          module: {
            type: "string",
            enum: [
              "sop_guide",
              "data_cleaning",
              "data_check",
              "baseline_regression",
              "robustness",
              "iv",
              "mechanism",
              "heterogeneity"
            ]
          }
        },
        required: ["module"]
      }
    }
  }
];

const MODULE_TO_STEP: Record<string, WorkflowStep> = {
  sop_guide: WorkflowStep.SOP_GUIDE,
  data_cleaning: WorkflowStep.DATA_CLEANING,
  data_check: WorkflowStep.DATA_CHECK,
  baseline_regression: WorkflowStep.BASELINE_REGRESSION,
  robustness: WorkflowStep.ROBUSTNESS,
  iv: WorkflowStep.IV,
  mechanism: WorkflowStep.MECHANISM,
  heterogeneity: WorkflowStep.HETEROGENEITY
};

@Injectable()
export class ResearchAgentService {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly messagesService: MessagesService,
    private readonly researchProfileService: ResearchProfileService,
    private readonly promptService: PromptService,
    private readonly llmService: LlmService,
    private readonly harnessService: HarnessService,
    private readonly inputSourceService: InputSourceService,
    private readonly workflowService: WorkflowService
  ) {}

  async handleTurn(params: {
    projectId: string;
    resumeToken?: string;
    userMessage: string;
    requestedStep?: WorkflowStep;
    payload?: Record<string, unknown>;
    agentRunId?: string | null;
    onProgress?: (progress: WorkflowProgressPayload) => void | Promise<void>;
  }) {
    const project = await this.projectsService.assertProjectAccess(params.projectId, params.resumeToken);
    const requestedStep = (params.requestedStep ?? project.currentStep) as WorkflowStep;
    const phase = this.resolvePhase(project.currentStep as WorkflowStep);
    const turnContext = await this.inputSourceService.prepareTurnContext({
      projectId: params.projectId,
      runId: params.agentRunId ?? null,
      userMessage: params.userMessage,
      payload: params.payload ?? {}
    });
    const budgetedMessage = await this.harnessService.budgetUserMessage({
      projectId: params.projectId,
      runId: params.agentRunId ?? null,
      userMessage: turnContext.userMessageForStorage
    });
    const userMessage = budgetedMessage.userMessage;
    const compactPayload = turnContext.compactPayload;

    await this.messagesService.createMessage({
      projectId: params.projectId,
      role: "user",
      messageType: AssistantMessageType.SYSTEM_NOTICE,
      step: requestedStep,
      contentText: userMessage,
      contentJson: {
        userMessage,
        artifactIds: [...budgetedMessage.artifactIds, ...turnContext.sourceArtifactIds],
        sourceArtifactIds: turnContext.sourceArtifactIds,
        sourceSummaries: turnContext.sourceSummaries,
        payload: compactPayload,
        requestedStep,
        phase
      }
    });

    const systemPrompt = await this.buildSystemPrompt(params.projectId, phase, requestedStep);
    const messages = await this.buildConversation(
      params.projectId,
      userMessage,
      compactPayload,
      turnContext.sourceContextText
    );
    const toolExecutions: AgentToolExecution[] = [];
    let currentStep = project.currentStep as WorkflowStep;

    try {
      for (let iteration = 0; iteration < 4; iteration += 1) {
        const response = await this.llmService.generateAgentResponse(systemPrompt, messages, RESEARCH_AGENT_TOOLS, {
          profile: "reasoning",
          toolChoice: "auto",
          maxTokens: 1800
        });
        messages.push(response.assistantMessage);

        if (response.toolCalls.length === 0) {
          const content = response.content?.trim();
          if (!content) {
            throw new Error("Research Agent returned neither text nor a tool call.");
          }

          return this.saveFinalResponse({
            projectId: params.projectId,
            requestedStep,
            currentStep,
            content,
            phase,
            toolExecutions
          });
        }

        for (const toolCall of response.toolCalls) {
          const execution = await this.executeTool({
            projectId: params.projectId,
            phase,
            userMessage,
            requestPayload: compactPayload,
            requestedStep,
            toolCall,
            agentRunId: params.agentRunId,
            onProgress: params.onProgress
          });
          toolExecutions.push(execution);
          const resultStep = execution.result.currentStep;
          if (typeof resultStep === "string" && Object.values(WorkflowStep).includes(resultStep as WorkflowStep)) {
            currentStep = resultStep as WorkflowStep;
          }
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id ?? `agent_tool_${iteration}`,
            content: JSON.stringify(execution.result)
          });
        }
      }

      throw new Error("Research Agent exceeded the maximum tool-call iterations.");
    } catch (error) {
      if (toolExecutions.length > 0) {
        const lastExecution = toolExecutions[toolExecutions.length - 1];
        const content = lastExecution.ok
          ? "操作已经完成，但生成最终说明时发生错误。请以当前已保存的项目状态为准。"
          : `操作未能完成：${String(lastExecution.result.error ?? "工具执行失败")}。`;
        return this.saveFinalResponse({
          projectId: params.projectId,
          requestedStep,
          currentStep,
          content,
          phase,
          toolExecutions
        });
      }

      return this.runDeterministicFallback({
        projectId: params.projectId,
        userMessage,
        requestedStep,
        phase,
        payload: compactPayload,
        currentStep,
        agentRunId: params.agentRunId,
        onProgress: params.onProgress,
        error
      });
    }
  }

  private async buildSystemPrompt(projectId: string, phase: AgentPhase, requestedStep: WorkflowStep) {
    const [basePrompt, profile, sourceIndex] = await Promise.all([
      this.promptService.getResearchAgentPrompt(),
      this.researchProfileService.getByProjectId(projectId),
      this.inputSourceService.buildProjectSourceIndex(projectId)
    ]);

    return [
      basePrompt,
      "",
      "# 当前运行上下文",
      `当前产品阶段：${phase}`,
      `当前用户查看模块：${requestedStep}`,
      `当前研究设定：${JSON.stringify(profile ?? {})}`,
      "",
      "# 历史输入源索引",
      sourceIndex || "暂无历史输入源。",
      "",
      "如果用户问题需要回看历史上传/粘贴材料，且当前研究设定和短历史不足以判断，可以调用 recall_sources。不要把索引当作材料全文。",
      "",
      "当前可用工具由系统提供。直接回答不需要工具；修改状态或生成工作流必须使用工具。"
    ].join("\n");
  }

  private async buildConversation(
    projectId: string,
    userMessage: string,
    payload: Record<string, unknown>,
    sourceContextText: string
  ): Promise<LlmChatMessage[]> {
    const recentMessages = await this.messagesService.getRecentMessages(projectId, 12);
    const history = recentMessages.slice(0, -1).map((message) => ({
      role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: this.trimText(
        message.contentText?.trim() || JSON.stringify(message.contentJson ?? {}),
        HISTORY_MESSAGE_LIMIT
      )
    }));
    const payloadText = Object.keys(payload).length > 0
      ? `\n\n[用户本轮提交的结构化内容]\n${JSON.stringify(payload)}`
      : "";

    return [
      ...history,
      {
        role: "user",
        content: [
          "[用户本轮输入]",
          userMessage,
          sourceContextText,
          payloadText.trim()
        ].filter(Boolean).join("\n\n")
      }
    ];
  }

  private async executeTool(params: {
    projectId: string;
    phase: AgentPhase;
    userMessage: string;
    requestPayload: Record<string, unknown>;
    requestedStep: WorkflowStep;
    toolCall: LlmToolCall;
    agentRunId?: string | null;
    onProgress?: (progress: WorkflowProgressPayload) => void | Promise<void>;
  }): Promise<AgentToolExecution> {
    const startedAt = Date.now();
    const permission = this.harnessService.authorizeTool(params.toolCall.name, params.toolCall.arguments);
    let result: Record<string, unknown>;

    if (permission.decision !== "allow") {
      result = { ok: false, error: permission.reason };
      await this.harnessService.recordToolResult({
        projectId: params.projectId,
        runId: params.agentRunId ?? null,
        toolUseId: params.toolCall.id,
        toolName: params.toolCall.name,
        step: params.requestedStep,
        status: permission.decision === "approve" ? "needs_approval" : "denied",
        permissionDecision: permission.decision,
        inputJson: params.toolCall.arguments,
        outputJson: result,
        durationMs: Date.now() - startedAt
      });
      return { name: params.toolCall.name, ok: false, result };
    }

    try {
      result = await this.dispatchTool(params);
      await this.harnessService.recordToolResult({
        projectId: params.projectId,
        runId: params.agentRunId ?? null,
        toolUseId: params.toolCall.id,
        toolName: params.toolCall.name,
        step: params.requestedStep,
        status: result.ok === false ? "error" : "success",
        permissionDecision: permission.decision,
        inputJson: params.toolCall.arguments,
        outputJson: result,
        durationMs: Date.now() - startedAt
      });
      return { name: params.toolCall.name, ok: result.ok !== false, result };
    } catch (error) {
      result = {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
      await this.harnessService.recordToolResult({
        projectId: params.projectId,
        runId: params.agentRunId ?? null,
        toolUseId: params.toolCall.id,
        toolName: params.toolCall.name,
        step: params.requestedStep,
        status: "error",
        permissionDecision: permission.decision,
        inputJson: params.toolCall.arguments,
        outputJson: result,
        errorJson: result,
        durationMs: Date.now() - startedAt
      });
      return { name: params.toolCall.name, ok: false, result };
    }
  }

  private async dispatchTool(params: {
    projectId: string;
    phase: AgentPhase;
    userMessage: string;
    requestPayload: Record<string, unknown>;
    requestedStep: WorkflowStep;
    toolCall: LlmToolCall;
    agentRunId?: string | null;
    onProgress?: (progress: WorkflowProgressPayload) => void | Promise<void>;
  }): Promise<Record<string, unknown>> {
    const args = params.toolCall.arguments;

    if (params.toolCall.name === "recall_sources") {
      return this.inputSourceService.recallSources({
        projectId: params.projectId,
        sourceIds: args.sourceIds,
        query: args.query,
        maxChunks: args.maxChunks
      });
    }

    if (params.toolCall.name === "update_research_profile") {
      return this.workflowService.updateResearchProfileFromAgent({
        projectId: params.projectId,
        userMessage: params.userMessage,
        profileUpdates: {
          ...params.requestPayload,
          ...this.recordArg(args.profileUpdates)
        },
        clearFields: this.stringArrayArg(args.clearFields),
        phase: params.phase,
        agentRunId: params.agentRunId
      });
    }

    if (params.toolCall.name === "validate_research_setup") {
      return this.workflowService.validateResearchSetupFromAgent(params.projectId, params.agentRunId);
    }

    if (params.toolCall.name === "generate_workflow") {
      if (!/(确认|生成|开始|继续|可以|好的|没问题)/i.test(params.userMessage)) {
        return {
          ok: false,
          error: "用户本轮没有明确要求生成工作流，已拒绝执行。"
        };
      }
      if (Object.keys(params.requestPayload).length > 0) {
        await this.workflowService.updateResearchProfileFromAgent({
          projectId: params.projectId,
          userMessage: params.userMessage,
          profileUpdates: params.requestPayload,
          phase: params.phase,
          agentRunId: params.agentRunId
        });
      }
      return this.workflowService.generateWorkflowFromAgent({
        projectId: params.projectId,
        agentRunId: params.agentRunId,
        onProgress: params.onProgress
      });
    }

    if (params.toolCall.name === "regenerate_workflow_module") {
      const moduleName = typeof args.module === "string" ? args.module : "";
      const requestedStep = MODULE_TO_STEP[moduleName];
      if (!requestedStep) {
        return { ok: false, error: `Unknown workflow module: ${moduleName}` };
      }
      return this.workflowService.regenerateWorkflowModuleFromAgent({
        projectId: params.projectId,
        requestedStep,
        agentRunId: params.agentRunId
      });
    }

    return {
      ok: false,
      error: `Unknown tool: ${params.toolCall.name}`
    };
  }

  private async saveFinalResponse(params: {
    projectId: string;
    requestedStep: WorkflowStep;
    currentStep: WorkflowStep;
    content: string;
    phase: AgentPhase;
    toolExecutions: AgentToolExecution[];
  }) {
    const updateResult = [...params.toolExecutions]
      .reverse()
      .find((execution) => execution.name === "update_research_profile")?.result;
    const shouldConfirmSetup =
      params.phase === "research_setup" &&
      updateResult?.ok === true &&
      updateResult?.setupComplete === true;
    const messageType = shouldConfirmSetup
      ? AssistantMessageType.TOPIC_CONFIRM
      : updateResult?.ok === true && Array.isArray(updateResult.missingFields) && updateResult.missingFields.length > 0
        ? AssistantMessageType.SYSTEM_NOTICE
        : AssistantMessageType.RESEARCH_CHAT;
    const profileContent = this.recordArg(updateResult?.researchProfile);

    const assistantMessage = await this.messagesService.createMessage({
      projectId: params.projectId,
      role: "assistant",
      messageType,
      step: shouldConfirmSetup ? WorkflowStep.TOPIC_NORMALIZE : params.requestedStep,
      contentText: params.content,
      contentJson: {
        message: params.content,
        ...profileContent,
        toolExecutions: params.toolExecutions,
        missingFields: updateResult?.missingFields ?? [],
        confirmationMessage: shouldConfirmSetup ? "如无问题，请确认并直接生成整套 Stata 工作流。" : undefined
      }
    });

    return {
      projectId: params.projectId,
      currentStep: params.currentStep,
      assistantMessage
    };
  }

  private async runDeterministicFallback(params: {
    projectId: string;
    userMessage: string;
    requestedStep: WorkflowStep;
    phase: AgentPhase;
    payload: Record<string, unknown>;
    currentStep: WorkflowStep;
    agentRunId?: string | null;
    onProgress?: (progress: WorkflowProgressPayload) => void | Promise<void>;
    error: unknown;
  }) {
    await this.harnessService.recordEvent({
      projectId: params.projectId,
      runId: params.agentRunId ?? null,
      type: "agent_fallback",
      phase: "error",
      message: params.error instanceof Error ? params.error.message : String(params.error)
    });

    if (/^(确认|确认主题|确认并生成|生成工作流|开始生成|可以生成|好的|没问题)$/i.test(params.userMessage.trim())) {
      const result = await this.workflowService.generateWorkflowFromAgent({
        projectId: params.projectId,
        agentRunId: params.agentRunId,
        onProgress: params.onProgress
      });
      const content = result.ok
        ? "已根据当前研究设定生成完整的 Stata 工作流。"
        : `当前还不能生成工作流，请先补充：${result.missingFieldLabels.join("、")}。`;
      return this.saveFinalResponse({
        projectId: params.projectId,
        requestedStep: params.requestedStep,
        currentStep: result.currentStep,
        content,
        phase: params.phase,
        toolExecutions: [{ name: "generate_workflow", ok: result.ok, result }]
      });
    }

    const isLikelyQuestion = /[?？]|是什么|为什么|怎么|如何|是否|能否|能不能|解释|含义|区别|适合|报错/.test(
      params.userMessage
    );
    const inferred = isLikelyQuestion ? {} : inferProfileUpdates(params.userMessage) as Record<string, unknown>;
    if (Object.keys(inferred).length > 0 || Object.keys(params.payload).length > 0) {
      const result = await this.workflowService.updateResearchProfileFromAgent({
        projectId: params.projectId,
        userMessage: params.userMessage,
        profileUpdates: { ...params.payload, ...inferred },
        phase: params.phase,
        agentRunId: params.agentRunId
      });
      const content = result.setupComplete
        ? "我已经整理好研究设定。请确认是否生成完整的 Stata 工作流。"
        : `我已经更新研究设定，还需要补充：${result.missingFieldLabels.join("、")}。`;
      return this.saveFinalResponse({
        projectId: params.projectId,
        requestedStep: params.requestedStep,
        currentStep: (result.currentStep as WorkflowStep | undefined) ?? params.currentStep,
        content,
        phase: params.phase,
        toolExecutions: [{ name: "update_research_profile", ok: true, result }]
      });
    }

    const content = "AI 助手本轮调用失败，请稍后重试。研究设定和工作流状态没有被修改。";
    return this.saveFinalResponse({
      projectId: params.projectId,
      requestedStep: params.requestedStep,
      currentStep: params.currentStep,
      content,
      phase: params.phase,
      toolExecutions: []
    });
  }

  private resolvePhase(currentStep: WorkflowStep): AgentPhase {
    return currentStep === WorkflowStep.TOPIC_DETECT || currentStep === WorkflowStep.TOPIC_NORMALIZE
      ? "research_setup"
      : "workflow_ready";
  }

  private recordArg(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  private stringArrayArg(value: unknown) {
    return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
  }

  private trimText(value: string, maxLength: number) {
    return trimHeadTail(value, maxLength, 500, 500);
  }
}
