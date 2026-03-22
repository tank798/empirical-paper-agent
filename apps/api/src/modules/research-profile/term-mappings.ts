import type { ResearchProfile, TermMapping, TermMappingCategory } from "@empirical/shared";

type MappingSeed = Pick<
  ResearchProfile,
  | "independentVariable"
  | "dependentVariable"
  | "controls"
  | "fixedEffects"
  | "clusterVar"
  | "panelId"
  | "timeVar"
>;

type AliasBundle = {
  termMappings: TermMapping[];
  independentAlias: string;
  dependentAlias: string;
  controlAliases: string[];
  fixedEffectAliases: string[];
  clusterAlias: string;
  panelAlias: string;
  timeAlias: string;
  preferredPanelAlias: string;
  preferredTimeAlias: string;
};

const DIRECT_ALIAS_BY_LABEL: Record<string, string> = {
  数字金融: "digitfin",
  数字化转型: "digital",
  金融监管: "regulation",
  金融监管强度: "reg_intensity",
  地方监管力度: "reg_intensity",
  地方监管: "regulation",
  监管处罚: "penalty",
  机构持股: "insthold",
  企业创新: "innovation",
  企业价值: "firm_value",
  企业esg表现: "esg",
  企业esg: "esg",
  esg表现: "esg",
  esg评级: "esg",
  企业规模: "size",
  资产负债率: "lev",
  总资产收益率: "roa",
  净资产收益率: "roe",
  现金流: "cfo",
  现金比率: "cash",
  股权集中度: "top1",
  企业年龄: "age",
  研发投入: "rd",
  托宾q: "tobinq",
  成长性: "growth",
  独立董事比例: "indepdir",
  董事会规模: "board",
  两职合一: "dual",
  企业固定效应: "firm_id",
  公司固定效应: "firm_id",
  个体固定效应: "id",
  年份固定效应: "year",
  时间固定效应: "year",
  行业固定效应: "industry_id",
  地区固定效应: "region_id",
  省份固定效应: "province_id",
  城市固定效应: "city_id",
  企业聚类: "firm_id",
  公司聚类: "firm_id",
  行业聚类: "industry_id",
  年份聚类: "year"
};

function cleanLabel(value?: string | null) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function buildLookupKey(value: string) {
  return value.toLowerCase().replace(/[\s，,、；;：:（）()\[\]【】]/g, "");
}

function sanitizeAlias(alias: string) {
  const next = alias
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");

  return next || "var";
}

function looksAsciiVariable(value: string) {
  return /^[A-Za-z][A-Za-z0-9_\s-]*$/.test(value.trim());
}

function inferStandardAlias(label: string, category: TermMappingCategory) {
  const cleaned = cleanLabel(label);
  const key = buildLookupKey(cleaned);
  if (!cleaned) {
    return "";
  }

  if (DIRECT_ALIAS_BY_LABEL[cleaned]) {
    return DIRECT_ALIAS_BY_LABEL[cleaned];
  }
  if (DIRECT_ALIAS_BY_LABEL[key]) {
    return DIRECT_ALIAS_BY_LABEL[key];
  }

  const lower = cleaned.toLowerCase();
  if (looksAsciiVariable(cleaned)) {
    return sanitizeAlias(lower);
  }

  if (lower.includes("esg")) {
    return "esg";
  }
  if (lower.includes("roa")) {
    return "roa";
  }
  if (lower.includes("roe")) {
    return "roe";
  }
  if (lower.includes("tobin")) {
    return "tobinq";
  }
  if (key.includes("企业规模")) {
    return "size";
  }
  if (key.includes("资产负债率")) {
    return "lev";
  }
  if (key.includes("现金流")) {
    return "cfo";
  }
  if (key.includes("现金比率")) {
    return "cash";
  }
  if (key.includes("股权集中度")) {
    return "top1";
  }
  if (key.includes("企业年龄")) {
    return "age";
  }
  if (key.includes("研发投入")) {
    return "rd";
  }
  if (key.includes("创新")) {
    return category === "dependent" ? "y" : "innovation";
  }
  if (key.includes("价值")) {
    return category === "dependent" ? "firm_value" : "value";
  }
  if (key.includes("监管处罚")) {
    return "penalty";
  }
  if (key.includes("监管")) {
    return category === "independent" ? "x" : "regulation";
  }
  if (key.includes("数字金融")) {
    return category === "independent" ? "x" : "digitfin";
  }
  if (key.includes("数字化转型")) {
    return category === "independent" ? "x" : "digital";
  }
  if (key.includes("机构持股")) {
    return category === "independent" ? "x" : "insthold";
  }
  if (key.includes("企业固定效应") || key.includes("公司固定效应")) {
    return "firm_id";
  }
  if (key.includes("年份固定效应") || key.includes("时间固定效应")) {
    return "year";
  }
  if (key.includes("行业固定效应")) {
    return "industry_id";
  }
  if (key.includes("地区固定效应")) {
    return "region_id";
  }
  if (key.includes("省份固定效应")) {
    return "province_id";
  }
  if (key.includes("城市固定效应")) {
    return "city_id";
  }

  return "";
}

function fallbackAlias(category: TermMappingCategory, index: number) {
  switch (category) {
    case "independent":
      return index === 0 ? "x" : `x${index + 1}`;
    case "dependent":
      return index === 0 ? "y" : `y${index + 1}`;
    case "control":
      return `ctrl${index + 1}`;
    case "fixed_effect":
      return `fe${index + 1}`;
    case "cluster":
      return index === 0 ? "cluster_id" : `cluster${index + 1}`;
    case "panel":
      return index === 0 ? "panel_id" : `panel${index + 1}`;
    case "time":
      return index === 0 ? "year" : `time${index + 1}`;
    default:
      return `var${index + 1}`;
  }
}

function ensureUniqueAlias(alias: string, used: Set<string>) {
  const normalized = sanitizeAlias(alias);
  if (!used.has(normalized)) {
    used.add(normalized);
    return normalized;
  }

  let nextIndex = 2;
  while (used.has(`${normalized}_${nextIndex}`)) {
    nextIndex += 1;
  }

  const nextAlias = `${normalized}_${nextIndex}`;
  used.add(nextAlias);
  return nextAlias;
}

function appendMappings(
  target: TermMapping[],
  used: Set<string>,
  category: TermMappingCategory,
  labels: Array<string | null | undefined>
) {
  labels.forEach((rawLabel, index) => {
    const labelCn = cleanLabel(rawLabel);
    if (!labelCn) {
      return;
    }

    const preferredAlias = inferStandardAlias(labelCn, category) || fallbackAlias(category, index);
    target.push({
      category,
      labelCn,
      alias: ensureUniqueAlias(preferredAlias, used)
    });
  });
}

function findAlias(termMappings: TermMapping[], category: TermMappingCategory, label: string | null | undefined, fallback: string) {
  const cleaned = cleanLabel(label);
  if (!cleaned) {
    return fallback;
  }

  const exact = termMappings.find((item) => item.category === category && item.labelCn === cleaned);
  if (exact) {
    return exact.alias;
  }

  const fuzzy = termMappings.find((item) => item.category === category && buildLookupKey(item.labelCn) === buildLookupKey(cleaned));
  return fuzzy?.alias ?? fallback;
}

function firstAlias(termMappings: TermMapping[], category: TermMappingCategory, fallback = "") {
  return termMappings.find((item) => item.category === category)?.alias ?? fallback;
}

export function buildTermMappings(input: MappingSeed): TermMapping[] {
  const used = new Set<string>();
  const termMappings: TermMapping[] = [];

  appendMappings(termMappings, used, "independent", [input.independentVariable]);
  appendMappings(termMappings, used, "dependent", [input.dependentVariable]);
  appendMappings(termMappings, used, "control", input.controls ?? []);
  appendMappings(termMappings, used, "fixed_effect", input.fixedEffects ?? []);
  appendMappings(termMappings, used, "cluster", input.clusterVar ? [input.clusterVar] : []);
  appendMappings(termMappings, used, "panel", input.panelId ? [input.panelId] : []);
  appendMappings(termMappings, used, "time", input.timeVar ? [input.timeVar] : []);

  return termMappings;
}

export function buildTermAliasBundle(input: MappingSeed & { termMappings?: TermMapping[] }): AliasBundle {
  const termMappings = input.termMappings?.length ? input.termMappings : buildTermMappings(input);
  const fixedEffectAliases = (input.fixedEffects ?? []).map((label, index) =>
    findAlias(termMappings, "fixed_effect", label, fallbackAlias("fixed_effect", index))
  );
  const panelAlias = findAlias(termMappings, "panel", input.panelId, "");
  const timeAlias = findAlias(termMappings, "time", input.timeVar, "");
  const preferredPanelAlias = panelAlias || fixedEffectAliases.find((alias) => /firm|panel|id/i.test(alias)) || "";
  const preferredTimeAlias = timeAlias || fixedEffectAliases.find((alias) => /year|time/i.test(alias)) || "";

  return {
    termMappings,
    independentAlias: findAlias(termMappings, "independent", input.independentVariable, "x"),
    dependentAlias: findAlias(termMappings, "dependent", input.dependentVariable, "y"),
    controlAliases: (input.controls ?? []).map((label, index) =>
      findAlias(termMappings, "control", label, fallbackAlias("control", index))
    ),
    fixedEffectAliases,
    clusterAlias: findAlias(termMappings, "cluster", input.clusterVar, preferredPanelAlias || "cluster_id"),
    panelAlias,
    timeAlias,
    preferredPanelAlias,
    preferredTimeAlias
  };
}

export function getFirstAliasByCategory(termMappings: TermMapping[], category: TermMappingCategory, fallback = "") {
  return firstAlias(termMappings, category, fallback);
}
