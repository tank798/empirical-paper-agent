import { Injectable } from "@nestjs/common";
import type { ResearchProfile, TermMapping } from "@empirical/shared";
import { PrismaService } from "../prisma/prisma.service";
import { buildTermMappings } from "./term-mappings";

type RegressionInput = {
  dependentVariable: string;
  independentVariable: string;
  controls: string[];
  fixedEffects: string[];
  clusterVar: string | null;
  panelId: string | null;
  timeVar: string | null;
  sampleScope: string | null;
  normalizedTopic: string;
  termMappings: TermMapping[];
};

@Injectable()
export class ResearchProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getByProjectId(projectId: string): Promise<ResearchProfile | null> {
    const profile = await this.prisma.researchProfile.findUnique({ where: { projectId } });
    return profile ? this.mapProfile(profile) : null;
  }

  async initializeFromNormalization(
    projectId: string,
    payload: {
      normalizedTopic: string;
      independentVariable: string;
      dependentVariable: string;
      researchObject: string;
      relationship: string;
    }
  ) {
    const termMappings = buildTermMappings({
      independentVariable: payload.independentVariable,
      dependentVariable: payload.dependentVariable,
      controls: [],
      fixedEffects: [],
      clusterVar: null,
      panelId: null,
      timeVar: null
    });

    const profile = await this.prisma.researchProfile.upsert({
      where: { projectId },
      create: {
        projectId,
        normalizedTopic: payload.normalizedTopic,
        independentVariable: payload.independentVariable,
        dependentVariable: payload.dependentVariable,
        researchObject: payload.researchObject,
        relationship: payload.relationship,
        controls: [],
        fixedEffects: [],
        termMappingsJson: termMappings as never
      },
      update: {
        normalizedTopic: payload.normalizedTopic,
        independentVariable: payload.independentVariable,
        dependentVariable: payload.dependentVariable,
        researchObject: payload.researchObject,
        relationship: payload.relationship,
        termMappingsJson: termMappings as never
      }
    });

    return this.mapProfile(profile);
  }

  async mergeExplicitUpdates(projectId: string, payload: Partial<ResearchProfile>) {
    const existing = await this.prisma.researchProfile.findUnique({ where: { projectId } });
    const mergedCore = {
      normalizedTopic: payload.normalizedTopic ?? existing?.normalizedTopic ?? "",
      independentVariable: payload.independentVariable ?? existing?.independentVariable ?? "",
      dependentVariable: payload.dependentVariable ?? existing?.dependentVariable ?? "",
      researchObject: payload.researchObject ?? existing?.researchObject ?? "",
      relationship: payload.relationship ?? existing?.relationship ?? "",
      controls: payload.controls ?? existing?.controls ?? [],
      fixedEffects: payload.fixedEffects ?? existing?.fixedEffects ?? [],
      clusterVar: payload.clusterVar ?? existing?.clusterVar ?? null,
      panelId: payload.panelId ?? existing?.panelId ?? null,
      timeVar: payload.timeVar ?? existing?.timeVar ?? null,
      sampleScope: payload.sampleScope ?? existing?.sampleScope ?? null,
      notes: payload.notes ?? existing?.notes ?? null
    };

    const termMappings = Array.isArray(payload.termMappings) && payload.termMappings.length > 0
      ? payload.termMappings
      : buildTermMappings({
          independentVariable: mergedCore.independentVariable,
          dependentVariable: mergedCore.dependentVariable,
          controls: mergedCore.controls,
          fixedEffects: mergedCore.fixedEffects,
          clusterVar: mergedCore.clusterVar,
          panelId: mergedCore.panelId,
          timeVar: mergedCore.timeVar
        });

    const profile = await this.prisma.researchProfile.upsert({
      where: { projectId },
      create: {
        projectId,
        ...mergedCore,
        termMappingsJson: termMappings as never
      },
      update: {
        ...mergedCore,
        termMappingsJson: termMappings as never
      }
    });

    return this.mapProfile(profile);
  }

  resolveRegressionInput(
    stored: ResearchProfile | null,
    payload: Record<string, unknown>,
    recentMessages: Array<{ contentText?: string | null; contentJson?: Record<string, unknown> }>
  ): RegressionInput {
    const inferred = this.inferFromMessages(recentMessages);
    const resolved = {
      dependentVariable:
        (stored?.dependentVariable || payload.dependentVariable || inferred.dependentVariable || "y") as string,
      independentVariable:
        (stored?.independentVariable || payload.independentVariable || inferred.independentVariable || "x") as string,
      controls:
        ((stored?.controls?.length ? stored.controls : payload.controls || inferred.controls || []) as string[]) ?? [],
      fixedEffects:
        ((stored?.fixedEffects?.length ? stored.fixedEffects : payload.fixedEffects || inferred.fixedEffects || []) as string[]) ?? [],
      clusterVar: (stored?.clusterVar || payload.clusterVar || inferred.clusterVar || null) as string | null,
      panelId: (stored?.panelId || payload.panelId || inferred.panelId || null) as string | null,
      timeVar: (stored?.timeVar || payload.timeVar || inferred.timeVar || null) as string | null,
      sampleScope: (stored?.sampleScope || payload.sampleScope || inferred.sampleScope || null) as string | null,
      normalizedTopic: (stored?.normalizedTopic || payload.normalizedTopic || inferred.normalizedTopic || "") as string
    };

    const termMappings = stored?.termMappings?.length
      ? stored.termMappings
      : buildTermMappings({
          independentVariable: resolved.independentVariable,
          dependentVariable: resolved.dependentVariable,
          controls: resolved.controls,
          fixedEffects: resolved.fixedEffects,
          clusterVar: resolved.clusterVar,
          panelId: resolved.panelId,
          timeVar: resolved.timeVar
        });

    return {
      ...resolved,
      termMappings
    };
  }

  private inferFromMessages(
    recentMessages: Array<{ contentText?: string | null; contentJson?: Record<string, unknown> }>
  ) {
    const text = recentMessages
      .map((message) => message.contentText || JSON.stringify(message.contentJson ?? {}))
      .join("\n");

    const firstMatch = (patterns: RegExp[]) => {
      for (const pattern of patterns) {
        const value = text.match(pattern)?.[1]?.trim();
        if (value) {
          return value;
        }
      }
      return "";
    };

    const splitList = (value: string) =>
      value
        .split(/[，,、\s]+/)
        .map((item) => item.trim())
        .filter(Boolean);

    return {
      dependentVariable: firstMatch([/dependent variable[:：]\s*([^\n]+)/i, /因变量[:：]\s*([^\n]+)/]),
      independentVariable: firstMatch([/independent variable[:：]\s*([^\n]+)/i, /自变量[:：]\s*([^\n]+)/]),
      controls: splitList(firstMatch([/controls[:：]\s*([^\n]+)/i, /控制变量[:：]\s*([^\n]+)/])),
      fixedEffects: splitList(firstMatch([/fixed effects[:：]\s*([^\n]+)/i, /固定效应[:：]\s*([^\n]+)/])),
      clusterVar: firstMatch([/cluster variable[:：]\s*([^\n]+)/i, /聚类变量[:：]\s*([^\n]+)/]) || null,
      panelId: firstMatch([/panel[_\s-]*id[:：]\s*([^\n]+)/i]) || null,
      timeVar: firstMatch([/time[_\s-]*var[:：]\s*([^\n]+)/i]) || null,
      sampleScope: firstMatch([/sample scope[:：]\s*([^\n]+)/i, /样本范围[:：]\s*([^\n]+)/]) || null,
      normalizedTopic: firstMatch([/topic[:：]\s*([^\n]+)/i, /题目[:：]\s*([^\n]+)/])
    };
  }

  private mapProfile(profile: {
    projectId: string;
    normalizedTopic: string;
    independentVariable: string;
    dependentVariable: string;
    researchObject: string;
    relationship: string;
    controls: string[];
    fixedEffects: string[];
    clusterVar: string | null;
    panelId: string | null;
    timeVar: string | null;
    sampleScope: string | null;
    notes: string | null;
    termMappingsJson: unknown;
  }): ResearchProfile {
    return {
      projectId: profile.projectId,
      normalizedTopic: profile.normalizedTopic,
      independentVariable: profile.independentVariable,
      dependentVariable: profile.dependentVariable,
      researchObject: profile.researchObject,
      relationship: profile.relationship,
      controls: profile.controls,
      fixedEffects: profile.fixedEffects,
      clusterVar: profile.clusterVar,
      panelId: profile.panelId,
      timeVar: profile.timeVar,
      sampleScope: profile.sampleScope,
      notes: profile.notes,
      termMappings: Array.isArray(profile.termMappingsJson) ? (profile.termMappingsJson as TermMapping[]) : []
    };
  }
}
