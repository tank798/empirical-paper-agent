export const DEFAULT_RESEARCH_OBJECT = "\u4e2d\u56fdA\u80a1\u4e0a\u5e02\u516c\u53f8";
export const DEFAULT_RELATIONSHIP_TEXT = "\u6b63\u5411\u3001\u8d1f\u5411\u548c\u4e0d\u663e\u8457";

const GENERIC_RESEARCH_OBJECTS = new Set([
  "\u4e2d\u56fd\u4f01\u4e1a",
  "\u4f01\u4e1a",
  "\u4e0a\u5e02\u516c\u53f8",
  "\u4e2d\u56fd\u4e0a\u5e02\u516c\u53f8",
  "A \u80a1\u4e0a\u5e02\u516c\u53f8",
  "A\u80a1\u4e0a\u5e02\u516c\u53f8",
  "A-share listed firms"
]);

const WORKFLOW_TERM_LABELS: Record<string, string> = {
  TOPIC_DETECT: "\u4e3b\u9898\u8bc6\u522b",
  TOPIC_NORMALIZE: "\u4e3b\u9898\u786e\u8ba4",
  SOP_GUIDE: "\u7814\u7a76\u8def\u5f84\u68b3\u7406",
  DATA_CLEANING: "\u6570\u636e\u5904\u7406",
  DATA_CHECK: "\u6570\u636e\u68c0\u67e5",
  BASELINE_REGRESSION: "\u57fa\u51c6\u56de\u5f52"
};

const WORKFLOW_ADVANCE_COPY: Record<string, string> = {
  TOPIC_DETECT: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u5e2e\u60a8\u8bc6\u522b\u5e76\u6536\u655b\u7814\u7a76\u4e3b\u9898\u3002",
  TOPIC_NORMALIZE: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u6574\u7406\u5e76\u786e\u8ba4\u7814\u7a76\u8bbe\u5b9a\u3002",
  SOP_GUIDE: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u4e3a\u60a8\u68b3\u7406\u7814\u7a76\u8def\u5f84\u3001\u53d8\u91cf\u6784\u5efa\u548c\u57fa\u51c6\u56de\u5f52\u601d\u8def\u3002",
  DATA_CLEANING: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u8fdb\u5165\u6570\u636e\u5904\u7406\u3002",
  DATA_CHECK: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u505a\u6570\u636e\u68c0\u67e5\u3002",
  BASELINE_REGRESSION: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u8fdb\u5165\u57fa\u51c6\u56de\u5f52\u3002"
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
      "1. 核心解释变量：金融监管强度的具体衡量指标（如监管处罚数量、监管发文数量等）",
      "2. 被解释变量：企业ESG表现的具体数据来源（如商道融绿、华证等）",
      "3. 控制变量列表",
      "4. 固定效应设定（是否使用行业、年份双固定效应）",
      "5. 数据时间范围",
      "如果你愿意，我可以基于这套设定继续生成数据清洗与回归代码。"
    ].join("\n");
  }

  text = text.replace(
    /主题识别正确[，,]?\s*研究主题为[“「"]?([^”」"]+)[”」"]?[。.]?\s*当前进入\s*(TOPIC_DETECT|TOPIC_NORMALIZE|SOP_GUIDE|DATA_CLEANING|DATA_CHECK|BASELINE_REGRESSION)\s*阶段[，,]?\s*需要为您生成标准化的实证研究操作流程指南[。.]?/gi,
    (_, topic, step) => `我已识别到您的研究主题“${topic}”。${WORKFLOW_ADVANCE_COPY[String(step).toUpperCase()] ?? "接下来我会继续帮您推进研究流程。"}`
  );

  text = text.replace(
    /(接下来将进入|当前进入)\s*\*{0,2}(TOPIC_DETECT|TOPIC_NORMALIZE|SOP_GUIDE|DATA_CLEANING|DATA_CHECK|BASELINE_REGRESSION)\*{0,2}\s*阶段/gi,
    (_, __, step) => WORKFLOW_ADVANCE_COPY[String(step).toUpperCase()] ?? "接下来我会继续推进当前研究流程。"
  );

  text = text.replace(
    /当前模块(?:为|是)\s*[「“"]?\*{0,2}(TOPIC_DETECT|TOPIC_NORMALIZE|SOP_GUIDE|DATA_CLEANING|DATA_CHECK|BASELINE_REGRESSION)\*{0,2}[」”"]?/gi,
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
