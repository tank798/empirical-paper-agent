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

export function normalizeResearchObjectText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return GENERIC_RESEARCH_OBJECTS.has(trimmed) ? DEFAULT_RESEARCH_OBJECT : trimmed;
}

export function normalizeRelationshipText(value: unknown, normalizedTopic?: unknown) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  const topic = typeof normalizedTopic === "string" ? normalizedTopic.trim() : "";

  if (!trimmed) {
    return DEFAULT_RELATIONSHIP_TEXT;
  }

  if (/^(causal effect|\u56e0\u679c\u5f71\u54cd)$/i.test(trimmed)) {
    return DEFAULT_RELATIONSHIP_TEXT;
  }

  if (topic && trimmed === topic) {
    return DEFAULT_RELATIONSHIP_TEXT;
  }

  if (/(\u5bf9.+\u7684\u5f71\u54cd|\u5f71\u54cd\u7814\u7a76)$/i.test(trimmed)) {
    return DEFAULT_RELATIONSHIP_TEXT;
  }

  return trimmed;
}

export function normalizeAssistantCopy(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.includes("请提供以下关键信息以生成完整 SOP")) {
    return [
      "我建议的变量构建方法如下：",
      "1. 核心解释变量：金融监管强度的具体衡量指标（如监管处罚数量、监管发文数量等）",
      "2. 被解释变量：企业ESG表现的具体数据来源（如商道融绿、华证等）",
      "3. 控制变量列表",
      "4. 固定效应设定（是否使用行业、年份双固定效应）",
      "5. 数据时间范围",
      "如果你愿意，我可以基于这套设定继续生成数据清洗与回归代码。"
    ].join("\n");
  }

  return trimmed.replace(
    /研究对象：(中国企业|企业|上市公司|中国上市公司|A 股上市公司|A股上市公司|A-share listed firms)/g,
    `研究对象：${DEFAULT_RESEARCH_OBJECT}`
  );
}
