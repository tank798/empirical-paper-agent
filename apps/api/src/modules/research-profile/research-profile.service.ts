import { Injectable } from "@nestjs/common";
import type { DataDictionaryEntry, DataDictionaryRole, DataDictionaryType, ExportFormat, ResearchProfile, TermMapping } from "@empirical/shared";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeFixedEffects } from "../skills/skill.utils";
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
  analysisRoute: "panel_fe";
  didEnabled: boolean;
  psmEnabled: boolean;
  treatmentVar: string | null;
  policyTimeVar: string | null;
  policyStartYear: string | null;
  instrumentVariable: string | null;
  psmMatchVars: string[];
  mechanismVariables: string[];
  heterogeneityVars: string[];
  exportFormats: ExportFormat[];
  dataDictionary: DataDictionaryEntry[];
  termMappings: TermMapping[];
};

const EXPORT_FORMATS = new Set<ExportFormat>(["word", "latex", "excel", "stata_do"]);
const DATA_DICTIONARY_TYPES = new Set<DataDictionaryType>([
  "numeric",
  "string",
  "date",
  "categorical",
  "boolean",
  "unknown"
]);
const DATA_DICTIONARY_ROLES = new Set<DataDictionaryRole>([
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
]);

function normalizeExportFormats(values?: string[] | null): ExportFormat[] {
  const normalized = new Set<ExportFormat>();
  for (const value of values ?? []) {
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

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArrayField(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function normalizeDataDictionaryType(value: unknown): DataDictionaryType {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (/num|double|float|int|long|byte|数值|连续|金额|比例|指数/.test(normalized)) {
    return "numeric";
  }
  if (/str|char|text|文本|字符|名称|代码/.test(normalized)) {
    return "string";
  }
  if (/date|time|year|month|日期|时间|年份/.test(normalized)) {
    return "date";
  }
  if (/cat|class|enum|dummy|分组|类别|分类|虚拟/.test(normalized)) {
    return "categorical";
  }
  if (/bool|boolean|true|false|0\/1|是否/.test(normalized)) {
    return "boolean";
  }

  return DATA_DICTIONARY_TYPES.has(value as DataDictionaryType) ? (value as DataDictionaryType) : "unknown";
}

function normalizeDataDictionaryRole(value: unknown): DataDictionaryRole {
  const normalized = String(value ?? "").trim().toLowerCase().replace(/[\s_-]+/g, "");

  if (/被解释|因变量|dependent|outcome|^y$/.test(normalized)) {
    return "dependent";
  }
  if (/解释变量|核心变量|自变量|independent|explanatory|^x$/.test(normalized)) {
    return "independent";
  }
  if (/控制变量|control|covariate/.test(normalized)) {
    return "control";
  }
  if (/固定效应|fixedeffect|fe/.test(normalized)) {
    return "fixed_effect";
  }
  if (/聚类|cluster/.test(normalized)) {
    return "cluster";
  }
  if (/面板|个体|公司代码|证券代码|firm|company|panel|id/.test(normalized)) {
    return "panel";
  }
  if (/时间|年份|year|time|date/.test(normalized)) {
    return "time";
  }
  if (/处理组|政策处理|treat|did/.test(normalized)) {
    return "treatment";
  }
  if (/工具变量|instrument|iv/.test(normalized)) {
    return "instrument";
  }
  if (/机制|中介|mechanism|mediator/.test(normalized)) {
    return "mechanism";
  }
  if (/异质|分组|heterogeneity|group/.test(normalized)) {
    return "heterogeneity";
  }
  if (/匹配|psm|match/.test(normalized)) {
    return "match";
  }
  if (/样本|筛选|filter|sample/.test(normalized)) {
    return "sample_filter";
  }

  return DATA_DICTIONARY_ROLES.has(value as DataDictionaryRole) ? (value as DataDictionaryRole) : "unknown";
}

function normalizeDataDictionary(value: unknown): DataDictionaryEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const entries: DataDictionaryEntry[] = [];

  for (const rawItem of value) {
    if (!rawItem || typeof rawItem !== "object") {
      continue;
    }

    const item = rawItem as Record<string, unknown>;
    const variableName =
      stringField(item.variableName) ||
      stringField(item.name) ||
      stringField(item.varName) ||
      stringField(item.fieldName);
    if (!variableName) {
      continue;
    }

    const key = variableName.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    entries.push({
      variableName,
      labelCn: stringField(item.labelCn) || stringField(item.label) || stringField(item.chineseName),
      description: stringField(item.description) || stringField(item.definition) || stringField(item.meaning),
      dataType: normalizeDataDictionaryType(item.dataType ?? item.type),
      candidateRole: normalizeDataDictionaryRole(item.candidateRole ?? item.role),
      aliases: stringArrayField(item.aliases),
      source: stringField(item.source),
      notes: stringField(item.notes) || null,
      confidence:
        item.confidence === "high" || item.confidence === "medium" || item.confidence === "low"
          ? item.confidence
          : "medium"
    });
  }

  return entries.slice(0, 200);
}

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
      fixedEffects: normalizeFixedEffects(payload.fixedEffects ?? existing?.fixedEffects ?? []),
      clusterVar: payload.clusterVar ?? existing?.clusterVar ?? null,
      panelId: payload.panelId ?? existing?.panelId ?? null,
      timeVar: payload.timeVar ?? existing?.timeVar ?? null,
      sampleScope: payload.sampleScope ?? existing?.sampleScope ?? null,
      analysisRoute: payload.analysisRoute ?? existing?.analysisRoute ?? "panel_fe",
      didEnabled: payload.didEnabled ?? existing?.didEnabled ?? false,
      psmEnabled: payload.psmEnabled ?? existing?.psmEnabled ?? false,
      treatmentVar: payload.treatmentVar ?? existing?.treatmentVar ?? null,
      policyTimeVar: payload.policyTimeVar ?? existing?.policyTimeVar ?? null,
      policyStartYear: payload.policyStartYear ?? existing?.policyStartYear ?? null,
      instrumentVariable: payload.instrumentVariable ?? existing?.instrumentVariable ?? null,
      psmMatchVars: payload.psmMatchVars ?? existing?.psmMatchVars ?? [],
      mechanismVariables: payload.mechanismVariables ?? existing?.mechanismVariables ?? [],
      heterogeneityVars: payload.heterogeneityVars ?? existing?.heterogeneityVars ?? [],
      exportFormats: payload.exportFormats ?? existing?.exportFormats ?? [],
      notes: payload.notes ?? existing?.notes ?? null,
      dataDictionary:
        normalizeDataDictionary(payload.dataDictionary).length > 0
          ? normalizeDataDictionary(payload.dataDictionary)
          : normalizeDataDictionary((existing as { dataDictionaryJson?: unknown } | null)?.dataDictionaryJson)
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
          timeVar: mergedCore.timeVar,
          dataDictionary: mergedCore.dataDictionary
        });
    const { dataDictionary, ...profileCore } = mergedCore;

    const profile = await this.prisma.researchProfile.upsert({
      where: { projectId },
      create: {
        projectId,
        ...profileCore,
        dataDictionaryJson: dataDictionary as never,
        termMappingsJson: termMappings as never
      },
      update: {
        ...profileCore,
        dataDictionaryJson: dataDictionary as never,
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
      fixedEffects: normalizeFixedEffects(((stored?.fixedEffects?.length ? stored.fixedEffects : payload.fixedEffects || inferred.fixedEffects || []) as string[]) ?? []),
      clusterVar: (stored?.clusterVar || payload.clusterVar || inferred.clusterVar || null) as string | null,
      panelId: (stored?.panelId || payload.panelId || inferred.panelId || null) as string | null,
      timeVar: (stored?.timeVar || payload.timeVar || inferred.timeVar || null) as string | null,
      sampleScope: (stored?.sampleScope || payload.sampleScope || inferred.sampleScope || null) as string | null,
      normalizedTopic: (stored?.normalizedTopic || payload.normalizedTopic || inferred.normalizedTopic || "") as string,
      analysisRoute: "panel_fe" as const,
      didEnabled: Boolean(stored?.didEnabled ?? payload.didEnabled ?? inferred.didEnabled ?? false),
      psmEnabled: Boolean(stored?.psmEnabled ?? payload.psmEnabled ?? inferred.psmEnabled ?? false),
      treatmentVar: (stored?.treatmentVar || payload.treatmentVar || inferred.treatmentVar || null) as string | null,
      policyTimeVar: (stored?.policyTimeVar || payload.policyTimeVar || inferred.policyTimeVar || null) as string | null,
      policyStartYear: (stored?.policyStartYear || payload.policyStartYear || inferred.policyStartYear || null) as string | null,
      instrumentVariable: (stored?.instrumentVariable || payload.instrumentVariable || inferred.instrumentVariable || null) as string | null,
      psmMatchVars:
        (stored?.psmMatchVars?.length
          ? stored.psmMatchVars
          : Array.isArray(payload.psmMatchVars)
            ? (payload.psmMatchVars as string[])
            : inferred.psmMatchVars) ?? [],
      mechanismVariables:
        (stored?.mechanismVariables?.length
          ? stored.mechanismVariables
          : Array.isArray(payload.mechanismVariables)
            ? (payload.mechanismVariables as string[])
            : inferred.mechanismVariables) ?? [],
      heterogeneityVars:
        (stored?.heterogeneityVars?.length
          ? stored.heterogeneityVars
          : Array.isArray(payload.heterogeneityVars)
            ? (payload.heterogeneityVars as string[])
            : inferred.heterogeneityVars) ?? [],
      exportFormats:
        normalizeExportFormats(
          (stored?.exportFormats?.length
            ? stored.exportFormats
            : Array.isArray(payload.exportFormats)
              ? (payload.exportFormats as string[])
              : inferred.exportFormats) ?? []
        ),
      dataDictionary: stored?.dataDictionary?.length
        ? stored.dataDictionary
        : normalizeDataDictionary(payload.dataDictionary)
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
          timeVar: resolved.timeVar,
          dataDictionary: resolved.dataDictionary
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
    const didDisabled = /(?:不做|不需要|不用|no)\s*DID/i.test(text);
    const psmDisabled = /(?:不做|不需要|不用|no)\s*PSM/i.test(text);

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
      fixedEffects: normalizeFixedEffects(firstMatch([/fixed effects[:：]\s*([^\n]+)/i, /固定效应[:：]\s*([^\n]+)/])),
      clusterVar: firstMatch([/cluster variable[:：]\s*([^\n]+)/i, /聚类变量[:：]\s*([^\n]+)/]) || null,
      panelId: firstMatch([/panel[_\s-]*id[:：]\s*([^\n]+)/i, /面板\s*id[:：]\s*([^\n]+)/i, /个体变量[:：]\s*([^\n]+)/]) || null,
      timeVar: firstMatch([/time[_\s-]*var[:：]\s*([^\n]+)/i, /时间变量[:：]\s*([^\n]+)/, /年份变量[:：]\s*([^\n]+)/]) || null,
      sampleScope: firstMatch([/sample scope[:：]\s*([^\n]+)/i, /样本范围[:：]\s*([^\n]+)/]) || null,
      normalizedTopic: firstMatch([/topic[:：]\s*([^\n]+)/i, /题目[:：]\s*([^\n]+)/]),
      didEnabled: didDisabled ? false : /要做\s*DID|做\s*DID|政策冲击|处理组/.test(text),
      psmEnabled: psmDisabled ? false : /要做\s*PSM|做\s*PSM|匹配/.test(text),
      treatmentVar: firstMatch([/处理组变量[:：]\s*([^\n]+)/, /treatment variable[:：]\s*([^\n]+)/i]) || null,
      policyTimeVar: firstMatch([/政策时间变量[:：]\s*([^\n]+)/, /policy time variable[:：]\s*([^\n]+)/i]) || null,
      policyStartYear: firstMatch([/政策年份[:：]\s*([^\n]+)/, /policy year[:：]\s*([^\n]+)/i]) || null,
      instrumentVariable: firstMatch([/工具变量[:：]\s*([^\n]+)/, /instrument(?:al)? variable[:：]\s*([^\n]+)/i]) || null,
      psmMatchVars: splitList(firstMatch([/匹配变量[:：]\s*([^\n]+)/, /matching variables?[:：]\s*([^\n]+)/i])),
      mechanismVariables: splitList(firstMatch([/机制变量[:：]\s*([^\n]+)/, /mechanism variables?[:：]\s*([^\n]+)/i])),
      heterogeneityVars: splitList(firstMatch([/分组变量[:：]\s*([^\n]+)/, /异质性变量[:：]\s*([^\n]+)/, /heterogeneity variables?[:：]\s*([^\n]+)/i])),
      exportFormats: normalizeExportFormats(splitList(firstMatch([/导出格式[:：]\s*([^\n]+)/, /export formats?[:：]\s*([^\n]+)/i])))
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
    analysisRoute?: string | null;
    didEnabled?: boolean | null;
    psmEnabled?: boolean | null;
    treatmentVar?: string | null;
    policyTimeVar?: string | null;
    policyStartYear?: string | null;
    instrumentVariable?: string | null;
    psmMatchVars?: string[] | null;
    mechanismVariables?: string[] | null;
    heterogeneityVars?: string[] | null;
    exportFormats?: string[] | null;
    notes: string | null;
    dataDictionaryJson?: unknown;
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
      analysisRoute: "panel_fe",
      didEnabled: profile.didEnabled ?? false,
      psmEnabled: profile.psmEnabled ?? false,
      treatmentVar: profile.treatmentVar ?? null,
      policyTimeVar: profile.policyTimeVar ?? null,
      policyStartYear: profile.policyStartYear ?? null,
      instrumentVariable: profile.instrumentVariable ?? null,
      psmMatchVars: profile.psmMatchVars ?? [],
      mechanismVariables: profile.mechanismVariables ?? [],
      heterogeneityVars: profile.heterogeneityVars ?? [],
      exportFormats: normalizeExportFormats(profile.exportFormats),
      notes: profile.notes,
      dataDictionary: normalizeDataDictionary(profile.dataDictionaryJson),
      termMappings: Array.isArray(profile.termMappingsJson) ? (profile.termMappingsJson as TermMapping[]) : []
    };
  }
}
