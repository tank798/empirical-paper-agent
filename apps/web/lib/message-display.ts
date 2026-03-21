export const DEFAULT_RESEARCH_OBJECT = "中国A股上市公司";
export const DEFAULT_RELATIONSHIP_TEXT = "正向、负向和不显著";

const GENERIC_RESEARCH_OBJECTS = new Set([
  "中国企业",
  "企业",
  "上市公司",
  "中国上市公司",
  "A 股上市公司",
  "A股上市公司",
  "A-share listed firms"
]);

const WORKFLOW_TERM_LABELS: Record<string, string> = {
  TOPIC_DETECT: "研究设定整理",
  TOPIC_NORMALIZE: "研究设定确认",
  SOP_GUIDE: "研究路径",
  DATA_CLEANING: "数据处理",
  DATA_CHECK: "数据检查",
  BASELINE_REGRESSION: "基准回归",
  ROBUSTNESS: "稳健性检验",
  IV: "内生性分析",
  MECHANISM: "机制分析",
  HETEROGENEITY: "异质性分析",
  EXPORT_TABLE: "回归表导出"
};

const WORKFLOW_ADVANCE_COPY: Record<string, string> = {
  TOPIC_DETECT: "接下来我会先帮您整理研究设定。",
  TOPIC_NORMALIZE: "接下来我会先确认研究设定。",
  SOP_GUIDE: "接下来我会先整理研究路径。",
  DATA_CLEANING: "接下来我会先进入数据处理。",
  DATA_CHECK: "接下来我会先做数据检查。",
  BASELINE_REGRESSION: "接下来我会先进入基准回归。",
  ROBUSTNESS: "接下来我会继续生成稳健性检验。",
  IV: "接下来我会继续生成内生性分析。",
  MECHANISM: "接下来我会继续生成机制分析。",
  HETEROGENEITY: "接下来我会继续生成异质性分析。",
  EXPORT_TABLE: "接下来我会继续整理导出结果。"
};

function decodeEscapedUnicode(value: string) {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t");
}

export function normalizeDisplayText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  let text = decodeEscapedUnicode(value).trim();
  if (!text) {
    return "";
  }

  if (text.includes("请提供以下关键信息以生成完整 SOP")) {
    text = [
      "我建议的变量构建方法如下：",
      "1. 核心解释变量：请明确具体衡量指标与数据来源。",
      "2. 被解释变量：请明确具体口径与数据来源。",
      "3. 控制变量：请列出准备纳入的控制变量。",
      "4. 固定效应设定：请说明是否使用企业、年份、行业或地区固定效应。",
      "5. 样本区间：请说明时间范围与样本筛选规则。"
    ].join("\n");
  }

  text = text.replace(
    /主题识别正确[，,]?\s*研究主题为[“「"]?([^”」"]+)[”」"]?[。.]?\s*当前进入\s*(TOPIC_DETECT|TOPIC_NORMALIZE|SOP_GUIDE|DATA_CLEANING|DATA_CHECK|BASELINE_REGRESSION|ROBUSTNESS|IV|MECHANISM|HETEROGENEITY|EXPORT_TABLE)\s*阶段/gi,
    (_, topic, step) => `我已识别到您的研究主题“${topic}”。${WORKFLOW_ADVANCE_COPY[String(step).toUpperCase()] ?? "接下来我会继续帮您推进研究流程。"}`
  );

  text = text.replace(
    /(接下来将进入|当前进入)\s*\*{0,2}(TOPIC_DETECT|TOPIC_NORMALIZE|SOP_GUIDE|DATA_CLEANING|DATA_CHECK|BASELINE_REGRESSION|ROBUSTNESS|IV|MECHANISM|HETEROGENEITY|EXPORT_TABLE)\*{0,2}\s*阶段/gi,
    (_, __, step) => WORKFLOW_ADVANCE_COPY[String(step).toUpperCase()] ?? "接下来我会继续推进当前研究流程。"
  );

  text = text.replace(
    /当前模块(?:为|是)\s*[「“"]?\*{0,2}(TOPIC_DETECT|TOPIC_NORMALIZE|SOP_GUIDE|DATA_CLEANING|DATA_CHECK|BASELINE_REGRESSION|ROBUSTNESS|IV|MECHANISM|HETEROGENEITY|EXPORT_TABLE)\*{0,2}[」”"]?/gi,
    (_, step) => `当前这一步是「${WORKFLOW_TERM_LABELS[String(step).toUpperCase()] ?? "研究流程"}」`
  );

  text = text.replace(/标准化的实证研究操作流程指南/g, "研究路径建议");
  text = text.replace(/\bworkflow\b/gi, "研究流程");

  for (const [term, label] of Object.entries(WORKFLOW_TERM_LABELS)) {
    text = text.replace(new RegExp(`\\b${term}\\b`, "g"), label);
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function normalizeResearchObjectText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = normalizeDisplayText(value);
  if (!trimmed) {
    return "";
  }

  return GENERIC_RESEARCH_OBJECTS.has(trimmed) ? DEFAULT_RESEARCH_OBJECT : trimmed;
}

export function normalizeRelationshipText(value: unknown, normalizedTopic?: unknown) {
  const trimmed = typeof value === "string" ? normalizeDisplayText(value) : "";
  const topic = typeof normalizedTopic === "string" ? normalizeDisplayText(normalizedTopic) : "";

  if (!trimmed) {
    return DEFAULT_RELATIONSHIP_TEXT;
  }

  if (/^(causal effect|因果影响)$/i.test(trimmed)) {
    return DEFAULT_RELATIONSHIP_TEXT;
  }

  if (topic && trimmed === topic) {
    return DEFAULT_RELATIONSHIP_TEXT;
  }

  if (/(对.+的影响|影响研究)$/i.test(trimmed)) {
    return DEFAULT_RELATIONSHIP_TEXT;
  }

  return trimmed;
}

export function normalizeAssistantCopy(value: unknown) {
  const trimmed = normalizeDisplayText(value);
  if (!trimmed) {
    return "";
  }

  return trimmed.replace(
    /研究对象：(中国企业|企业|上市公司|中国上市公司|A 股上市公司|A股上市公司|A-share listed firms)/g,
    `研究对象：${DEFAULT_RESEARCH_OBJECT}`
  );
}
