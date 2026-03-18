import { BadRequestException, Injectable } from "@nestjs/common";
import { RegressionSkillNames, SkillName, WorkflowStep, type ResearchProfile } from "@empirical/shared";
import { PrismaService } from "../prisma/prisma.service";
import { PromptService } from "../prompt/prompt.service";
import { LlmService } from "../llm/llm.service";
import { ExportStateService } from "../export-state/export-state.service";
import { ResearchProfileService } from "../research-profile/research-profile.service";
import { MessagesService } from "../messages/messages.service";
import { ProjectsService } from "../projects/projects.service";
import { skillExecutionProfiles } from "./skill.execution-profiles";
import { normalizeResearchObject, normalizeSopGuideMessage } from "./skill.utils";
import { skillRegistry } from "./skills.registry";
import type { SkillRunResult } from "./skill.types";

type RecentMessage = {
  role: string;
  messageType: string;
  step: string | null;
  contentText?: string | null;
  contentJson?: Record<string, unknown>;
};

@Injectable()
export class SkillsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly promptService: PromptService,
    private readonly llmService: LlmService,
    private readonly exportStateService: ExportStateService,
    private readonly researchProfileService: ResearchProfileService,
    private readonly messagesService: MessagesService,
    private readonly projectsService: ProjectsService
  ) {}

  async executeSkill(params: {
    projectId: string;
    skillName: SkillName;
    step: WorkflowStep;
    payload?: Record<string, unknown>;
  }): Promise<SkillRunResult<any>> {
    const definition = skillRegistry[params.skillName];
    if (!definition) {
      throw new BadRequestException(`Unknown skill: ${params.skillName}`);
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
        ? this.compactMessages(recentMessages.slice(-executionProfile.promptMessageLimit))
        : []
    );
    const userPrompt = this.promptService.renderPrompt(prompt.template, promptPayload);

    let output: any;
    let fallbackUsed = false;
    let error: { type: string; message: string } | null = null;
    let resolvedModel = this.llmService.modelName;
    const shouldUseDeterministicFallback = params.skillName === SkillName.TOPIC_DETECT;

    if (shouldUseDeterministicFallback) {
      fallbackUsed = true;
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
        const generated = await this.llmService.generateJson(systemPrompt, userPrompt, {
          profile: executionProfile.llmProfile
        });
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
        status: fallbackUsed ? "fallback" : "success"
      }
    });

    await this.persistCodeBlocksIfNeeded(params.projectId, output);
    if (RegressionSkillNames.includes(params.skillName) && output.export) {
      await this.exportStateService.markRegressionExportUsed(params.projectId, {
        fileName: output.export.fileName,
        filePath: output.export.filePath
      });
    }

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
        needLogVars: (payload.needLogVars as string[] | undefined) ?? []
      };
    }

    if (skillName === SkillName.DATA_CHECK) {
      const resolved = this.researchProfileService.resolveRegressionInput(profile, payload, recentMessages);
      return {
        panelId: resolved.panelId,
        timeVar: resolved.timeVar,
        keyVariables: [resolved.dependentVariable, resolved.independentVariable, ...(resolved.controls ?? [])].filter(Boolean)
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
        sampleScope: resolved.sampleScope,
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
        topic: profile?.normalizedTopic ?? project.topicNormalized ?? project.topicRaw,
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
        topic: profile?.normalizedTopic ?? project.topicNormalized ?? project.topicRaw
      };
    }

    if (skillName === SkillName.RESULT_INTERPRET) {
      return {
        resultText: payload.resultText ?? payload.userMessage ?? "",
        currentModule: payload.currentModule ?? project.currentStep,
        topic: profile?.normalizedTopic ?? project.topicNormalized ?? project.topicRaw
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
        sampleScope: researchProfile.sampleScope
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
}
