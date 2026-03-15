import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import {
  MAIN_WORKFLOW_STEPS,
  ProjectStatus,
  ProjectStepStatus,
  SkillName,
  WorkflowStep,
  type ProjectDetail
} from "@empirical/shared";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildDefaultExportFileName,
  generateResumeToken,
  hashResumeToken,
  safeTitleFromTopic
} from "../../common/token";

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async createProject(topicRaw: string) {
    const trimmed = topicRaw.trim();
    if (!trimmed) {
      throw new BadRequestException("topicRaw is required");
    }

    const resumeToken = generateResumeToken();
    const resumeTokenHash = hashResumeToken(resumeToken);
    const title = safeTitleFromTopic(trimmed);
    const exportFileName = buildDefaultExportFileName(title);

    const project = await this.prisma.project.create({
      data: {
        title,
        topicRaw: trimmed,
        currentStep: WorkflowStep.TOPIC_DETECT,
        status: ProjectStatus.ACTIVE,
        resumeTokenHash,
        steps: {
          create: MAIN_WORKFLOW_STEPS.map((step, index) => ({
            step,
            status: index === 0 ? ProjectStepStatus.IN_PROGRESS : ProjectStepStatus.PENDING,
            startedAt: index === 0 ? new Date() : null,
            metadataJson: {} as never
          }))
        },
        exportState: {
          create: {
            defaultExportPath: `D:\\results\\${exportFileName}`,
            defaultExportFileName: exportFileName,
            hasWrittenRegressionTable: false,
            nextWriteMode: "replace"
          }
        }
      }
    });

    return {
      project: this.mapProject(project),
      resumeToken
    };
  }

  async assertProjectAccess(projectId: string, resumeToken?: string) {
    if (!resumeToken) {
      throw new UnauthorizedException("Missing project token");
    }

    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      throw new BadRequestException("Project not found");
    }

    if (project.resumeTokenHash !== hashResumeToken(resumeToken)) {
      throw new UnauthorizedException("Invalid project token");
    }

    return project;
  }

  async getProjectDetail(projectId: string, resumeToken?: string): Promise<ProjectDetail> {
    await this.assertProjectAccess(projectId, resumeToken);
    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      include: {
        steps: true,
        researchProfile: true,
        exportState: true
      }
    });

    const orderedSteps = [...project.steps].sort(
      (left, right) =>
        MAIN_WORKFLOW_STEPS.indexOf(left.step as WorkflowStep) -
        MAIN_WORKFLOW_STEPS.indexOf(right.step as WorkflowStep)
    );

    return {
      project: this.mapProject(project),
      steps: orderedSteps.map((step) => ({
        step: step.step as WorkflowStep,
        status: step.status as typeof ProjectStepStatus[keyof typeof ProjectStepStatus],
        startedAt: step.startedAt?.toISOString() ?? null,
        completedAt: step.completedAt?.toISOString() ?? null,
        metadata: (step.metadataJson as Record<string, unknown>) ?? {}
      })),
      researchProfile: project.researchProfile
        ? {
            projectId: project.researchProfile.projectId,
            normalizedTopic: project.researchProfile.normalizedTopic,
            independentVariable: project.researchProfile.independentVariable,
            dependentVariable: project.researchProfile.dependentVariable,
            researchObject: project.researchProfile.researchObject,
            relationship: project.researchProfile.relationship,
            controls: project.researchProfile.controls,
            fixedEffects: project.researchProfile.fixedEffects,
            clusterVar: project.researchProfile.clusterVar,
            panelId: project.researchProfile.panelId,
            timeVar: project.researchProfile.timeVar,
            sampleScope: project.researchProfile.sampleScope,
            notes: project.researchProfile.notes
          }
        : null,
      exportState: project.exportState
        ? {
            projectId: project.exportState.projectId,
            defaultExportPath: project.exportState.defaultExportPath,
            defaultExportFileName: project.exportState.defaultExportFileName,
            hasWrittenRegressionTable: project.exportState.hasWrittenRegressionTable,
            nextWriteMode: project.exportState.nextWriteMode as "replace" | "append",
            updatedAt: project.exportState.updatedAt.toISOString()
          }
        : null
    };
  }

  async updateCurrentStep(projectId: string, currentStep: WorkflowStep, lastSkillName?: string | null) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: {
        currentStep,
        lastSkillName: lastSkillName ?? undefined
      }
    });
  }

  async updateTopic(projectId: string, normalizedTopic: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { topicNormalized: normalizedTopic }
    });
  }

  async updateStepStatus(
    projectId: string,
    step: WorkflowStep,
    status: string,
    metadata: Record<string, unknown> = {}
  ) {
    return this.prisma.projectStep.update({
      where: { projectId_step: { projectId, step } },
      data: {
        status,
        startedAt: status === ProjectStepStatus.IN_PROGRESS ? new Date() : undefined,
        completedAt: status === ProjectStepStatus.COMPLETED ? new Date() : undefined,
        metadataJson: metadata as never
      }
    });
  }

  mapProject(project: {
    id: string;
    title: string;
    topicRaw: string;
    topicNormalized: string | null;
    currentStep: string;
    status: string;
    researchSummary: string | null;
    lastSkillName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProjectDetail["project"] {
    return {
      id: project.id,
      title: project.title,
      topicRaw: project.topicRaw,
      topicNormalized: project.topicNormalized,
      currentStep: project.currentStep as WorkflowStep,
      status: project.status as (typeof ProjectStatus)[keyof typeof ProjectStatus],
      researchSummary: project.researchSummary,
      lastSkillName: project.lastSkillName as (typeof SkillName)[keyof typeof SkillName] | null,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString()
    };
  }
}
