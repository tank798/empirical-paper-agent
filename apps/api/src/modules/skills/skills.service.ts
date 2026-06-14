import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { RegressionSkillNames, SkillName, WorkflowStep, type ResearchProfile } from "@empirical/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PromptService } from "../prompt/prompt.service";
import { LlmService, type LlmFunctionTool, type LlmProfileName, type LlmToolCall } from "../llm/llm.service";
import { ExportStateService } from "../export-state/export-state.service";
import { HarnessService } from "../harness/harness.service";
import { ResearchProfileService } from "../research-profile/research-profile.service";
import { MessagesService } from "../messages/messages.service";
import { ProjectsService } from "../projects/projects.service";
import { skillExecutionProfiles } from "./skill.execution-profiles";
import { normalizeResearchObject, normalizeSopGuideMessage, sanitizeSkillOutputStrings } from "./skill.utils";
import { skillRegistry } from "./skills.registry";
import type { SkillRunResult } from "./skill.types";
import {
  buildDataCheckOutputTemplate,
  buildDataCleaningOutputTemplate,
  buildRegressionModuleOutput
} from "./workflow-output.builder";

type RecentMessage = {
  role: string;
  messageType: string;
  step: string | null;
  contentText?: string | null;
  contentJson?: Record<string, unknown>;
};

const DETERMINISTIC_WORKFLOW_SKILLS = new Set<SkillName>([
  SkillName.SOP_GUIDE,
  SkillName.DATA_CLEANING,
  SkillName.DATA_CHECK,
  SkillName.BASELINE_REGRESSION,
  SkillName.ROBUSTNESS,
  SkillName.IV,
  SkillName.MECHANISM,
  SkillName.HETEROGENEITY
]);

const workflowDataDictionaryItemProperties = {
  variableName: { type: "string", description: "数据中的真实字段名，例如 stkcd、year、rd_exp" },
  labelCn: { type: "string", description: "字段中文名或变量标签；没有时省略" },
  description: { type: "string", description: "字段定义、计算口径、单位或数据来源；没有时省略" },
  dataType: {
    type: "string",
    enum: ["numeric", "string", "date", "categorical", "boolean", "unknown"],
    description: "字段类型"
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
    ],
    description: "根据字段名、中文含义和当前研究设定判断出的候选角色；不确定时填 unknown"
  },
  aliases: {
    type: "array",
    items: { type: "string" },
    description: "同义名称、中文别名或英文别名"
  },
  source: { type: "string", description: "字段来源，例如 CSMAR、Wind、用户上传数据字典；未知时省略" },
  notes: { type: "string", description: "风险提示或待确认事项；没有时省略" },
  confidence: { type: "string", enum: ["high", "medium", "low"], description: "字段理解置信度" }
} as const;

const workflowProfileUpdateProperties = {
  normalizedTopic: { type: "string", description: "规范化后的论文题目或研究主题" },
  independentVariable: { type: "string", description: "核心解释变量" },
  dependentVariable: { type: "string", description: "被解释变量" },
  researchObject: { type: "string", description: "研究对象或样本对象" },
  relationship: { type: "string", description: "理论关系描述" },
  controls: {
    type: "array",
    items: { type: "string" },
    description: "控制变量列表"
  },
  fixedEffects: {
    type: "array",
    items: { type: "string" },
    description: "固定效应列表"
  },
  clusterVar: { type: "string", description: "聚类变量；未知时省略该字段" },
  panelId: { type: "string", description: "面板个体变量；未知时省略该字段" },
  timeVar: { type: "string", description: "面板时间变量；未知时省略该字段" },
  sampleScope: { type: "string", description: "样本区间或样本范围；未知时省略该字段" },
  analysisRoute: {
    type: "string",
    enum: ["panel_fe"],
    description: "当前产品只支持 panel_fe"
  },
  didEnabled: { type: "boolean", description: "用户是否明确选择做 DID 扩展" },
  psmEnabled: { type: "boolean", description: "用户是否明确选择做 PSM 扩展" },
  treatmentVar: { type: "string", description: "DID 或 PSM 处理变量；未知时省略该字段" },
  policyTimeVar: { type: "string", description: "政策时间变量；未知时省略该字段" },
  policyStartYear: { type: "string", description: "政策开始年份；未知时省略该字段" },
  instrumentVariable: { type: "string", description: "用户提供的真实工具变量；未知时省略该字段" },
  psmMatchVars: {
    type: "array",
    items: { type: "string" },
    description: "PSM 匹配变量"
  },
  mechanismVariables: {
    type: "array",
    items: { type: "string" },
    description: "机制变量"
  },
  heterogeneityVars: {
    type: "array",
    items: { type: "string" },
    description: "异质性或分组变量"
  },
  exportFormats: {
    type: "array",
    items: { type: "string", enum: ["word", "latex", "excel", "stata_do"] },
    description: "目标导出格式"
  },
  notes: { type: "string", description: "其他用户补充说明；没有时省略该字段" },
  dataDictionary: {
    type: "array",
    items: {
      type: "object",
      additionalProperties: false,
      properties: workflowDataDictionaryItemProperties,
      required: ["variableName"]
    },
    description: "用户上传、粘贴或口头说明的数据字典字段列表"
  }
} as const;

const workflowInterpreterTools: LlmFunctionTool[] = [
  {
    type: "function",
    function: {
      name: "update_research_profile",
      description:
        "用户在补充或修改面板实证论文研究设定时调用。包括题目、变量、样本、固定效应、DID/PSM 选择、IV、机制、异质性、导出格式，也可以包含少量数据字典字段。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          interpretedIntent: { type: "string" },
          normalizedUserMessage: { type: "string" },
          reason: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          profileUpdates: {
            type: "object",
            additionalProperties: false,
            properties: workflowProfileUpdateProperties
          }
        },
        required: ["interpretedIntent", "normalizedUserMessage", "profileUpdates"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_data_dictionary",
      description:
        "用户上传、粘贴或口头描述数据字典、变量表、字段含义、变量标签、Excel/CSV 表头时调用。需要抽取真实字段名、中文含义、数据类型、候选研究角色，并可顺带更新研究设定。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          interpretedIntent: { type: "string" },
          normalizedUserMessage: { type: "string" },
          dictionarySummary: { type: "string", description: "对数据字典整体内容的简短总结" },
          reason: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          dataDictionary: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: workflowDataDictionaryItemProperties,
              required: ["variableName"]
            }
          },
          profileUpdates: {
            type: "object",
            additionalProperties: false,
            properties: workflowProfileUpdateProperties
          },
          warnings: {
            type: "array",
            items: { type: "string" },
            description: "字段含义冲突、疑似口径不清或需要用户确认的事项"
          }
        },
        required: ["interpretedIntent", "normalizedUserMessage", "dataDictionary"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "continue_workflow",
      description:
        "用户只是确认、要求继续或要求按当前研究设定推进工作流，且没有新的研究设定字段需要写入时调用。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          interpretedIntent: { type: "string" },
          normalizedUserMessage: { type: "string" },
          reason: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["interpretedIntent", "normalizedUserMessage"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "ask_clarification",
      description:
        "用户意图不足以继续生成，需要追问缺失信息时调用，例如缺少面板 id、时间变量、真实工具变量或 PSM 匹配变量。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          interpretedIntent: { type: "string" },
          clarificationQuestion: { type: "string" },
          guidanceTitle: { type: "string" },
          guidanceOptions: { type: "array", items: { type: "string" } },
          reason: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["interpretedIntent", "clarificationQuestion"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "answer_research_question",
      description:
        "用户只是在问概念、代码含义、M1-M6、固定效应、DID/PSM/IV 是否适合等普通研究问题时调用。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          interpretedIntent: { type: "string" },
          normalizedUserMessage: { type: "string" },
          reason: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["interpretedIntent", "normalizedUserMessage"]
      }
    }
  }
];

const researchSetupInterpreterTools: LlmFunctionTool[] = [
  {
    type: "function",
    function: {
      name: "update_research_profile",
      description:
        "用户提供、粘贴或上传了研究设定、开题报告、变量表或数据字典时调用。把能识别的研究主题、变量、样本、固定效应、面板字段和扩展方法放入 profileUpdates。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          assistantMessage: {
            type: "string",
            description: "给用户看的简短反馈；说明已识别内容和还缺什么，或提示可确认生成。"
          },
          missingFields: {
            type: "array",
            items: { type: "string" },
            description: "仍缺失的字段 key，例如 controls、sampleScope、fixedEffects；没有缺失则为空数组。"
          },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          profileUpdates: {
            type: "object",
            additionalProperties: false,
            properties: workflowProfileUpdateProperties
          }
        },
        required: ["assistantMessage", "profileUpdates"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "answer_research_question",
      description: "用户是在问经管实证、变量、模型、Stata 或论文方法问题，不是在提供新的研究设定时调用。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          assistantMessage: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["assistantMessage"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "handle_irrelevant_input",
      description: "用户输入与经管实证论文研究无关，且没有有效研究设定字段时调用。",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          assistantMessage: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] }
        },
        required: ["assistantMessage"]
      }
    }
  }
];

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptService: PromptService,
    private readonly llmService: LlmService,
    private readonly exportStateService: ExportStateService,
    private readonly researchProfileService: ResearchProfileService,
    private readonly messagesService: MessagesService,
    private readonly projectsService: ProjectsService,
    private readonly harnessService: HarnessService
  ) {}

  async executeSkill(params: {
    projectId: string;
    skillName: SkillName;
    step: WorkflowStep;
    payload?: Record<string, unknown>;
    agentRunId?: string | null;
    executionMode?: "auto" | "deterministic";
  }): Promise<SkillRunResult<any>> {
    const definition = skillRegistry[params.skillName];
    if (!definition) {
      throw new BadRequestException(`Unknown skill: ${params.skillName}`);
    }

    const startedAt = Date.now();
    const permission = this.harnessService.authorizeTool(params.skillName, params.payload ?? {});
    if (permission.decision !== "allow") {
      await this.harnessService.recordToolResult({
        projectId: params.projectId,
        runId: params.agentRunId ?? null,
        toolUseId: null,
        toolName: params.skillName,
        step: params.step,
        status: permission.decision === "approve" ? "needs_approval" : "denied",
        permissionDecision: permission.decision,
        inputJson: (params.payload ?? {}) as Record<string, unknown>,
        errorJson: {
          type: "permission",
          message: permission.reason
        },
        durationMs: Date.now() - startedAt
      });
      throw new ForbiddenException(permission.reason);
    }
    const executionProfile = skillExecutionProfiles[params.skillName];
    const projectRecord = await this.prisma.project.findUniqueOrThrow({ where: { id: params.projectId } });
    const profile = await this.researchProfileService.getByProjectId(params.projectId);
    const messageWindow = Math.max(
      executionProfile.inferenceMessageLimit,
      executionProfile.promptMessageLimit
    );
    const recentMessages =
      messageWindow > 0 ? await this.messagesService.getRecentMessages(params.projectId, messageWindow) : [];

    const preparedInput = await this.prepareInput(
      params.skillName,
      params.payload ?? {},
      profile,
      recentMessages,
      this.projectsService.mapProject(projectRecord)
    );
    const input = definition.inputSchema.parse(preparedInput);
    const prompt = await this.promptService.getSkillPrompt(definition.promptKey as never);
    const systemPrompt = await this.promptService.getSystemPrompt();
    const promptPayload = this.buildPromptPayload(
      input,
      executionProfile.includeResearchProfileInPrompt ? profile : null,
      executionProfile.promptMessageLimit > 0
        ? this.harnessService.buildSkillContext({
            recentMessages: recentMessages.slice(-executionProfile.promptMessageLimit),
            messageBudget: 280
          })
        : []
    );
    const userPrompt = this.promptService.renderPrompt(prompt.template, promptPayload);

    let output: any;
    let fallbackUsed = false;
    let error: { type: string; message: string } | null = null;
    let resolvedModel = this.llmService.modelName;
    const shouldUseDeterministicExecution =
      params.executionMode === "deterministic" ||
      params.skillName === SkillName.TOPIC_DETECT ||
      DETERMINISTIC_WORKFLOW_SKILLS.has(params.skillName);

    if (shouldUseDeterministicExecution) {
      resolvedModel = "deterministic";
      output = definition.outputSchema.parse(
        definition.fallback(input, {
          projectId: params.projectId,
          currentStep: params.step,
          projectTitle: projectRecord.title,
          promptVersion: prompt.version
        })
      );
    } else {
      try {
        let generationPromise: Promise<{ data: Record<string, unknown>; model: string }>;
        if (params.skillName === SkillName.WORKFLOW_INPUT_INTERPRETER) {
          generationPromise = this.generateWorkflowInterpreterWithTools(
            systemPrompt,
            userPrompt,
            input,
            executionProfile.llmProfile
          );
        } else if (params.skillName === SkillName.RESEARCH_SETUP_INTERPRETER) {
          generationPromise = this.generateResearchSetupInterpreterWithTools(
            systemPrompt,
            userPrompt,
            input,
            executionProfile.llmProfile
          );
        } else {
          generationPromise = this.llmService.generateJson(systemPrompt, userPrompt, {
            profile: executionProfile.llmProfile
          });
        }
        const generated = await this.withTimeout(
          generationPromise,
          executionProfile.timeoutMs,
          `${params.skillName} timed out and fell back to deterministic output.`
        );
        resolvedModel = generated.model;
        output = definition.outputSchema.parse(generated.data);
      } catch (llmError) {
        fallbackUsed = true;
        error = {
          type: "skill_fallback",
          message: llmError instanceof Error ? llmError.message : "Skill fell back to deterministic output"
        };
        output = definition.outputSchema.parse(
          definition.fallback(input, {
            projectId: params.projectId,
            currentStep: params.step,
            projectTitle: projectRecord.title,
            promptVersion: prompt.version
          })
        );
      }
    }

    if (params.skillName === SkillName.SOP_GUIDE && typeof output?.message === "string") {
      output = {
        ...output,
        message: normalizeSopGuideMessage(output.message)
      };
    }

    output = sanitizeSkillOutputStrings(output);
    output = this.normalizeStructuredModuleOutput(params.skillName, input, output);

    const run = await this.prisma.skillRun.create({
      data: {
        projectId: params.projectId,
        skillName: params.skillName,
        step: params.step,
        inputJson: input as never,
        outputJson: output as never,
        errorJson: error as never,
        promptVersion: prompt.version,
        model: resolvedModel,
        status: shouldUseDeterministicExecution ? "deterministic" : fallbackUsed ? "fallback" : "success"
      }
    });

    await this.persistCodeBlocksIfNeeded(params.projectId, output);
    if (RegressionSkillNames.includes(params.skillName) && output.export) {
      await this.exportStateService.markRegressionExportUsed(params.projectId, {
        fileName: output.export.fileName,
        filePath: output.export.filePath
      });
    }

    await this.harnessService.recordToolResult({
      projectId: params.projectId,
      runId: params.agentRunId ?? null,
      toolUseId: run.id,
      toolName: params.skillName,
      step: params.step,
      status: fallbackUsed ? "fallback" : "success",
      permissionDecision: permission.decision,
      inputJson: input as Record<string, unknown>,
      outputJson: output as Record<string, unknown>,
      errorJson: error,
      durationMs: Date.now() - startedAt
    });

    return {
      success: true,
      skillName: params.skillName,
      messageType: definition.messageType,
      data: output,
      error,
      fallbackUsed,
      runId: run.id
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) {
    let timer: NodeJS.Timeout | null = null;

    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => {
            reject(new Error(timeoutMessage));
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async generateWorkflowInterpreterWithTools(
    systemPrompt: string,
    userPrompt: string,
    input: Record<string, any>,
    profile: LlmProfileName
  ) {
    try {
      const toolResult = await this.llmService.generateToolCall(systemPrompt, userPrompt, workflowInterpreterTools, {
        profile,
        toolChoice: "required"
      });
      const toolCall = toolResult.toolCalls[0];
      if (!toolCall) {
        throw new Error("The model did not return a workflow interpreter tool call.");
      }

      return {
        data: this.mapWorkflowInterpreterToolCall(toolCall, input),
        model: toolResult.model
      };
    } catch (toolError) {
      try {
        return await this.llmService.generateJson(systemPrompt, userPrompt, { profile });
      } catch (jsonError) {
        throw new Error(
          `Workflow interpreter tool-call failed: ${this.errorMessage(toolError)}; JSON fallback failed: ${this.errorMessage(jsonError)}`
        );
      }
    }
  }

  private async generateResearchSetupInterpreterWithTools(
    systemPrompt: string,
    userPrompt: string,
    input: Record<string, any>,
    profile: LlmProfileName
  ) {
    try {
      const toolResult = await this.llmService.generateToolCall(systemPrompt, userPrompt, researchSetupInterpreterTools, {
        profile,
        toolChoice: "required"
      });
      const toolCall = toolResult.toolCalls[0];
      if (!toolCall) {
        throw new Error("The model did not return a research setup tool call.");
      }

      return {
        data: this.mapResearchSetupInterpreterToolCall(toolCall, input),
        model: toolResult.model
      };
    } catch (toolError) {
      try {
        return await this.llmService.generateJson(systemPrompt, userPrompt, { profile });
      } catch (jsonError) {
        throw new Error(
          `Research setup tool-call failed: ${this.errorMessage(toolError)}; JSON fallback failed: ${this.errorMessage(jsonError)}`
        );
      }
    }
  }

  private mapResearchSetupInterpreterToolCall(toolCall: LlmToolCall, input: Record<string, any>) {
    const args = toolCall.arguments;

    if (toolCall.name === "update_research_profile") {
      return {
        intent: "research_setup",
        profileUpdates: this.profileUpdatesArg(args),
        missingFields: this.stringArrayArg(args.missingFields),
        assistantMessage: this.stringArg(
          args.assistantMessage,
          "我已经整理出一版研究设定，请确认字段是否正确。"
        ),
        confidence: this.confidenceArg(args.confidence)
      };
    }

    if (toolCall.name === "answer_research_question") {
      return {
        intent: "research_question",
        profileUpdates: {},
        missingFields: [],
        assistantMessage: this.stringArg(args.assistantMessage, "我先回答您的研究方法问题。"),
        confidence: this.confidenceArg(args.confidence)
      };
    }

    if (toolCall.name === "handle_irrelevant_input") {
      return {
        intent: "irrelevant",
        profileUpdates: {},
        missingFields: [],
        assistantMessage: this.stringArg(
          args.assistantMessage,
          "这条消息里没有可识别的研究设定。您可以直接提供研究主题、变量、样本区间和固定效应。"
        ),
        confidence: this.confidenceArg(args.confidence)
      };
    }

    throw new Error(`Unknown research setup interpreter tool call: ${toolCall.name}`);
  }

  private mapWorkflowInterpreterToolCall(toolCall: LlmToolCall, input: Record<string, any>) {
    const args = toolCall.arguments;
    const toolCallTrace = {
      name: toolCall.name,
      arguments: args
    };

    if (toolCall.name === "update_research_profile") {
      return {
        route: "continue_workflow",
        interpretedIntent: this.stringArg(args.interpretedIntent, "update_research_profile"),
        normalizedUserMessage: this.stringArg(args.normalizedUserMessage, input.userMessage ?? ""),
        reason: this.stringArg(args.reason, "用户补充或修改了研究设定"),
        confidence: this.confidenceArg(args.confidence),
        profileUpdates: this.profileUpdatesArg(args),
        toolCall: toolCallTrace
      };
    }

    if (toolCall.name === "update_data_dictionary") {
      const profileUpdates = this.profileUpdatesArg(args);
      const dataDictionary = this.dataDictionaryArg(args.dataDictionary ?? profileUpdates.dataDictionary);
      return {
        route: "continue_workflow",
        interpretedIntent: this.stringArg(args.interpretedIntent, "update_data_dictionary"),
        normalizedUserMessage: this.stringArg(args.normalizedUserMessage, input.userMessage ?? ""),
        reason: this.stringArg(args.reason, "用户补充了数据字典或变量字段说明"),
        confidence: this.confidenceArg(args.confidence),
        profileUpdates: {
          ...profileUpdates,
          ...(dataDictionary.length > 0 ? { dataDictionary } : {}),
          notes: this.mergeNotes(profileUpdates.notes, args.dictionarySummary, args.warnings)
        },
        toolCall: toolCallTrace
      };
    }

    if (toolCall.name === "continue_workflow") {
      return {
        route: "continue_workflow",
        interpretedIntent: this.stringArg(args.interpretedIntent, "continue_workflow"),
        normalizedUserMessage: this.stringArg(args.normalizedUserMessage, input.userMessage ?? ""),
        reason: this.stringArg(args.reason, "用户希望继续推进当前工作流"),
        confidence: this.confidenceArg(args.confidence),
        profileUpdates: {},
        toolCall: toolCallTrace
      };
    }

    if (toolCall.name === "ask_clarification") {
      return {
        route: "ask_clarification",
        interpretedIntent: this.stringArg(args.interpretedIntent, "ask_clarification"),
        normalizedUserMessage: "",
        clarificationQuestion: this.stringArg(args.clarificationQuestion, "请再补充一下必要的研究设定。"),
        guidanceTitle: this.stringArg(args.guidanceTitle, "需要补充的信息"),
        guidanceOptions: this.stringArrayArg(args.guidanceOptions),
        reason: this.stringArg(args.reason, "继续生成前还缺少必要信息"),
        confidence: this.confidenceArg(args.confidence),
        profileUpdates: {},
        toolCall: toolCallTrace
      };
    }

    if (toolCall.name === "answer_research_question") {
      return {
        route: "general_research_chat",
        interpretedIntent: this.stringArg(args.interpretedIntent, "answer_research_question"),
        normalizedUserMessage: this.stringArg(args.normalizedUserMessage, input.userMessage ?? ""),
        reason: this.stringArg(args.reason, "用户是在提出研究或代码概念问题"),
        confidence: this.confidenceArg(args.confidence),
        profileUpdates: {},
        toolCall: toolCallTrace
      };
    }

    throw new Error(`Unknown workflow interpreter tool call: ${toolCall.name}`);
  }

  private profileUpdatesArg(args: Record<string, unknown>) {
    const nested = this.objectArg(args.profileUpdates);
    if (Object.keys(nested).length > 0) {
      if (Object.prototype.hasOwnProperty.call(nested, "dataDictionary")) {
        return {
          ...nested,
          dataDictionary: this.dataDictionaryArg(nested.dataDictionary)
        };
      }

      return nested;
    }

    const updates = Object.fromEntries(
      Object.keys(workflowProfileUpdateProperties)
        .filter((key) => Object.prototype.hasOwnProperty.call(args, key))
        .map((key) => [key, args[key]])
    );
    if (Object.prototype.hasOwnProperty.call(updates, "dataDictionary")) {
      updates.dataDictionary = this.dataDictionaryArg(updates.dataDictionary);
    }

    return updates;
  }

  private objectArg(value: unknown) {
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  }

  private stringArg(value: unknown, fallback: string) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
  }

  private stringArrayArg(value: unknown) {
    if (!Array.isArray(value)) {
      return [] as string[];
    }

    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  private dataDictionaryArg(value: unknown) {
    if (!Array.isArray(value)) {
      return [] as Array<Record<string, unknown>>;
    }

    return value
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          return null;
        }

        const record = item as Record<string, unknown>;
        const variableName = this.stringArg(record.variableName, "");
        if (!variableName) {
          return null;
        }

        return {
          variableName,
          labelCn: this.stringArg(record.labelCn, ""),
          description: this.stringArg(record.description, ""),
          dataType: this.dictionaryTypeArg(record.dataType),
          candidateRole: this.dictionaryRoleArg(record.candidateRole),
          aliases: this.stringArrayArg(record.aliases),
          source: this.stringArg(record.source, ""),
          notes: this.stringArg(record.notes, ""),
          confidence: this.confidenceArg(record.confidence)
        };
      })
      .filter(Boolean) as Array<Record<string, unknown>>;
  }

  private dictionaryTypeArg(value: unknown) {
    return value === "numeric" ||
      value === "string" ||
      value === "date" ||
      value === "categorical" ||
      value === "boolean" ||
      value === "unknown"
      ? value
      : "unknown";
  }

  private dictionaryRoleArg(value: unknown) {
    return value === "dependent" ||
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
      ? value
      : "unknown";
  }

  private mergeNotes(...values: unknown[]) {
    return values
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter(Boolean)
      .join("\n");
  }

  private confidenceArg(value: unknown) {
    return value === "high" || value === "medium" || value === "low" ? value : "medium";
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private resolveResearchTopic(
    profile: ResearchProfile | null,
    project: { topicRaw: string; topicNormalized: string | null }
  ) {
    const topic = profile?.normalizedTopic || project.topicNormalized || project.topicRaw || "";
    const trimmed = topic.trim();
    if (!trimmed) {
      return "";
    }

    if (/^(hi|hello|hey|ok|okay|yes|no|你好|您好|在吗|哈喽|嗨)$/i.test(trimmed)) {
      return "";
    }

    if (trimmed.length <= 4 && !/(研究|影响|效应|关系|变量|样本|回归)/.test(trimmed)) {
      return "";
    }

    return trimmed;
  }

  private async prepareInput(
    skillName: SkillName,
    payload: Record<string, unknown>,
    profile: ResearchProfile | null,
    recentMessages: RecentMessage[],
    project: {
      id: string;
      title: string;
      topicRaw: string;
      topicNormalized: string | null;
      currentStep: string;
    }
  ) {
    if (skillName === SkillName.TOPIC_DETECT) {
      return { userInput: payload.userInput ?? project.topicRaw };
    }

    if (skillName === SkillName.TOPIC_NORMALIZE) {
      return { rawTopic: payload.rawTopic ?? payload.userInput ?? project.topicRaw };
    }

    if (skillName === SkillName.SOP_GUIDE) {
      return {
        normalizedTopic: payload.normalizedTopic ?? profile?.normalizedTopic ?? project.topicNormalized ?? project.topicRaw,
        researchObject: normalizeResearchObject((payload.researchObject as string | undefined) ?? profile?.researchObject ?? "A-share listed firms")
      };
    }

    if (skillName === SkillName.DATA_CLEANING) {
      return {
        dependentVariable: profile?.dependentVariable || payload.dependentVariable || "y",
        independentVariable: profile?.independentVariable || payload.independentVariable || "x",
        controls: profile?.controls?.length ? profile.controls : (payload.controls as string[] | undefined) ?? [],
        fixedEffects: profile?.fixedEffects?.length ? profile.fixedEffects : (payload.fixedEffects as string[] | undefined) ?? [],
        clusterVar: profile?.clusterVar || (payload.clusterVar as string | undefined) || null,
        panelId: profile?.panelId || (payload.panelId as string | undefined) || null,
        timeVar: profile?.timeVar || (payload.timeVar as string | undefined) || null,
        sampleScope: profile?.sampleScope || (payload.sampleScope as string | undefined) || null,
        termMappings: profile?.termMappings ?? [],
        needLogVars: (payload.needLogVars as string[] | undefined) ?? []
      };
    }

    if (skillName === SkillName.DATA_CHECK) {
      const resolved = this.researchProfileService.resolveRegressionInput(profile, payload, recentMessages);
      const keyVariables = [
        resolved.termMappings.find((item) => item.category === "dependent")?.alias || resolved.dependentVariable,
        resolved.termMappings.find((item) => item.category === "independent")?.alias || resolved.independentVariable,
        ...resolved.termMappings.filter((item) => item.category === "control").map((item) => item.alias)
      ].filter(Boolean);

      return {
        panelId: resolved.panelId,
        timeVar: resolved.timeVar,
        keyVariables
      };
    }

    if (RegressionSkillNames.includes(skillName)) {
      const resolved = this.researchProfileService.resolveRegressionInput(profile, payload, recentMessages);
      const exportState = await this.exportStateService.getNextRegressionExport(project.id, project.title, skillName, {
        fileName: payload.fileName as string | undefined,
        filePath: payload.filePath as string | undefined
      });

      return {
        dependentVariable: resolved.dependentVariable,
        independentVariable: resolved.independentVariable,
        controls: resolved.controls,
        fixedEffects: resolved.fixedEffects,
        clusterVar: resolved.clusterVar,
        panelId: resolved.panelId,
        timeVar: resolved.timeVar,
        sampleScope: resolved.sampleScope,
        instrumentVariable: resolved.instrumentVariable,
        mechanismVariables: resolved.mechanismVariables,
        heterogeneityVars: resolved.heterogeneityVars,
        didEnabled: resolved.didEnabled,
        psmEnabled: resolved.psmEnabled,
        treatmentVar: resolved.treatmentVar,
        policyTimeVar: resolved.policyTimeVar,
        policyStartYear: resolved.policyStartYear,
        psmMatchVars: resolved.psmMatchVars,
        exportFormats: resolved.exportFormats,
        termMappings: resolved.termMappings,
        exportState: {
          fileName: exportState.fileName,
          filePath: exportState.filePath,
          writeMode: exportState.writeMode
        }
      };
    }

    if (skillName === SkillName.WORKFLOW_INPUT_INTERPRETER) {
      return {
        userMessage: payload.userMessage ?? "",
        currentStep: payload.currentStep ?? project.currentStep,
        currentModule: payload.currentModule ?? project.currentStep,
        topic: this.resolveResearchTopic(profile, project),
        recentAssistantMessages: recentMessages
          .filter((message) => message.role !== "user")
          .map((message) => message.contentText ?? JSON.stringify(message.contentJson ?? {}))
          .filter(Boolean)
          .slice(-4)
      };
    }

    if (skillName === SkillName.RESEARCH_SETUP_INTERPRETER) {
      return {
        userMessage: payload.userMessage ?? "",
        currentStep: payload.currentStep ?? project.currentStep,
        currentModule: payload.currentModule ?? project.currentStep,
        topic: this.resolveResearchTopic(profile, project),
        recentAssistantMessages: recentMessages
          .filter((message) => message.role !== "user")
          .map((message) => message.contentText ?? JSON.stringify(message.contentJson ?? {}))
          .filter(Boolean)
          .slice(-4)
      };
    }

    if (skillName === SkillName.GENERAL_RESEARCH_CHAT) {
      return {
        userQuestion: payload.userQuestion ?? payload.userMessage ?? "",
        currentModule: payload.currentModule ?? project.currentStep,
        topic: this.resolveResearchTopic(profile, project)
      };
    }

    if (skillName === SkillName.RESULT_INTERPRET) {
      return {
        resultText: payload.resultText ?? payload.userMessage ?? "",
        currentModule: payload.currentModule ?? project.currentStep,
        topic: this.resolveResearchTopic(profile, project)
      };
    }

    if (skillName === SkillName.STATA_ERROR_DEBUG) {
      return {
        errorText: payload.errorText ?? payload.userMessage ?? "",
        relatedCode: payload.relatedCode ?? null
      };
    }

    return payload;
  }

  private buildPromptPayload(
    input: unknown,
    researchProfile: ResearchProfile | null,
    recentMessages: Array<{ role: string; messageType: string; step: string | null; content: string }>
  ) {
    const payload: Record<string, unknown> = { input };

    const compactProfile = this.compactResearchProfile(researchProfile);
    if (compactProfile) {
      payload.researchProfile = compactProfile;
    }

    if (recentMessages.length > 0) {
      payload.recentMessages = recentMessages;
    }

    return payload;
  }

  private compactResearchProfile(researchProfile: ResearchProfile | null) {
    if (!researchProfile) {
      return null;
    }

    const compact = Object.fromEntries(
      Object.entries({
        normalizedTopic: researchProfile.normalizedTopic,
        independentVariable: researchProfile.independentVariable,
        dependentVariable: researchProfile.dependentVariable,
        researchObject: normalizeResearchObject(researchProfile.researchObject),
        relationship: researchProfile.relationship,
        controls: researchProfile.controls,
        fixedEffects: researchProfile.fixedEffects,
        clusterVar: researchProfile.clusterVar,
        panelId: researchProfile.panelId,
        timeVar: researchProfile.timeVar,
        sampleScope: researchProfile.sampleScope,
        analysisRoute: researchProfile.analysisRoute,
        didEnabled: researchProfile.didEnabled,
        psmEnabled: researchProfile.psmEnabled,
        treatmentVar: researchProfile.treatmentVar,
        policyTimeVar: researchProfile.policyTimeVar,
        policyStartYear: researchProfile.policyStartYear,
        instrumentVariable: researchProfile.instrumentVariable,
        psmMatchVars: researchProfile.psmMatchVars,
        mechanismVariables: researchProfile.mechanismVariables,
        heterogeneityVars: researchProfile.heterogeneityVars,
        exportFormats: researchProfile.exportFormats,
        dataDictionary: researchProfile.dataDictionary?.slice(0, 80),
        termMappings: researchProfile.termMappings
      }).filter(([, value]) => {
        if (Array.isArray(value)) {
          return value.length > 0;
        }

        return value != null && String(value).trim() !== "";
      })
    );

    return Object.keys(compact).length > 0 ? compact : null;
  }

  private compactMessages(recentMessages: RecentMessage[]) {
    return recentMessages.map((message) => ({
      role: message.role,
      messageType: message.messageType,
      step: message.step,
      content: this.trimText(
        message.contentText?.trim() || this.safeStringify(message.contentJson ?? {}),
        280
      )
    }));
  }

  private trimText(value: string, maxLength: number) {
    const trimmed = value.trim();
    if (trimmed.length <= maxLength) {
      return trimmed;
    }

    return `${trimmed.slice(0, maxLength)}...`;
  }

  private safeStringify(value: Record<string, unknown>) {
    try {
      return JSON.stringify(value);
    } catch {
      return "{}";
    }
  }

  private async persistCodeBlocksIfNeeded(projectId: string, output: Record<string, any>) {
    if (!output.stataCode) {
      return;
    }

    await this.prisma.codeBlock.create({
      data: {
        projectId,
        moduleName: output.moduleName,
        language: "stata",
        code: output.stataCode,
        explanationJson: (output.codeExplanation ?? []) as never,
        exportCode: output.export?.exportCode ?? null
      }
    });
  }

  private normalizeStructuredModuleOutput(skillName: SkillName, input: Record<string, any>, output: Record<string, any>) {
    if (skillName === SkillName.DATA_CLEANING) {
      const template = buildDataCleaningOutputTemplate(input as any);
      return {
        ...output,
        purpose: template.purpose,
        variableDesign: template.variableDesign,
        termMappings: template.termMappings,
        modelSpec: template.modelSpec,
        stataCode: template.stataCode,
        codeExplanation: template.codeExplanation,
        interpretationGuide: template.interpretationGuide
      };
    }

    if (skillName === SkillName.DATA_CHECK) {
      const template = buildDataCheckOutputTemplate(input as any);
      return {
        ...output,
        variableDesign: template.variableDesign,
        modelSpec: template.modelSpec,
        stataCode: template.stataCode,
        codeExplanation: template.codeExplanation,
        checkItems: template.checkItems
      };
    }

    const regressionVariants: Partial<Record<SkillName, { label: string; variant: "baseline" | "robustness" | "iv" | "mechanism" | "heterogeneity" }>> = {
      [SkillName.BASELINE_REGRESSION]: { label: "基准回归", variant: "baseline" },
      [SkillName.ROBUSTNESS]: { label: "稳健性检验", variant: "robustness" },
      [SkillName.IV]: { label: "内生性分析", variant: "iv" },
      [SkillName.MECHANISM]: { label: "机制分析", variant: "mechanism" },
      [SkillName.HETEROGENEITY]: { label: "异质性分析", variant: "heterogeneity" }
    };

    const regressionConfig = regressionVariants[skillName];
    if (!regressionConfig) {
      return output;
    }

    const template = buildRegressionModuleOutput(skillName, input as any, regressionConfig.label, regressionConfig.variant);
    return {
      ...output,
      variableDesign: template.variableDesign,
      termMappings: template.termMappings,
      instrumentSelectionCriteria: template.instrumentSelectionCriteria,
      mechanismPaths: template.mechanismPaths,
      modelSpec: template.modelSpec,
      stataCode: template.stataCode,
      codeExplanation: template.codeExplanation,
      interpretationGuide: template.interpretationGuide,
      export: template.export
    };
  }
}
