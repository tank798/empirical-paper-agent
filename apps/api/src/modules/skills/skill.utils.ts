import {
  ExportWriteMode,
  SkillName,
  WorkflowStep,
  type GeneralResearchChatInput,
  type GeneralResearchChatOutput,
  type PlaceholderSkillOutput,
  type ResearchSetupInterpreterInput,
  type ResearchSetupInterpreterOutput,
  type ResearchSetupInterpreterProfilePatch,
  type RegressionSkillInput,
  type RegressionSkillOutput,
  type ResultInterpretInput,
  type ResultInterpretOutput,
  type StataErrorDebugInput,
  type StataErrorDebugOutput,
  type TopicDetectOutput,
  type TopicNormalizeOutput,
  type WorkflowInputInterpreterInput,
  type WorkflowInputInterpreterOutput,
  type WorkflowInputInterpreterProfilePatch
} from "@empirical/shared";
import { DATA_CLEANING_INSTALL_LINES, STATA_RESULTS_DIRECTORY } from "./stata-code.config";

function cleanTerm(value: string) {
  return value.replace(/[。；;,.，]/g, "").trim();
}

const CHINESE_INFLUENCE = "\\u5f71\\u54cd";
const CHINESE_TO = "\\u5bf9";
const CHINESE_AND = "\\u4e0e";
const CHINESE_AND_ALT = "\\u8207";

export const DEFAULT_RESEARCH_OBJECT = "中国A股上市公司";
export const DEFAULT_SETUP_EXAMPLE_MESSAGE = [
  "你可以像下面这样一次性告诉我你的研究设定：",
  "",
  "我想研究企业数字化转型对绿色创新的影响。",
  "",
  "本文选择2009到2025年沪深A股上市公司为研究样本，删除金融类企业、ST类企业以及主要变量缺失的样本。被解释变量为企业绿色创新水平，采用绿色专利申请数量加1后取自然对数作为代理变量。核心解释变量为企业数字化转型水平，采用年报文本中数字化相关词频加1后取自然对数作为代理变量。",
  "",
  "机制变量方面，我想检验企业数字化转型是否通过缓解融资约束和提高信息透明度影响绿色创新。其中，融资约束可以用SA指数或KZ指数衡量，信息透明度可以用分析师关注度或盈余管理程度衡量。",
  "",
  "控制变量包括企业年龄的对数 Age、企业规模 Size、资产负债率 Lev、营业收入增长率 Growth、现金比率 Cash、固定资产比率 Fixed、董事会规模 Board、独立董事比例 Indep、第一大股东持股比例 Top1、企业所在地区市场化程度 Market。",
  "",
  "固定效应采用企业固定效应和年份固定效应。面板个体变量为 stkcd，时间变量为 year。标准误按公司个体层面聚类，也就是按 stkcd 聚类。暂时不做DID、PSM和工具变量法。"
].join("\n");

const GENERIC_RESEARCH_OBJECTS = new Set([
  "中国企业",
  "企业",
  "上市公司",
  "中国上市公司",
  "中国A股上市公司",
  "A 股上市公司",
  "A股上市公司",
  "China A-share listed firms",
  "A-share listed firms"
]);

export function normalizeResearchObject(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_RESEARCH_OBJECT;
  }

  return GENERIC_RESEARCH_OBJECTS.has(trimmed) ? DEFAULT_RESEARCH_OBJECT : trimmed;
}

export function normalizeSopGuideMessage(value?: string | null) {
  const trimmed = value?.trim();
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

  return trimmed;
}

const workflowTermLabels: Record<string, string> = {
  TOPIC_DETECT: "\u4e3b\u9898\u8bc6\u522b",
  TOPIC_NORMALIZE: "\u4e3b\u9898\u786e\u8ba4",
  SOP_GUIDE: "\u7814\u7a76\u8def\u5f84\u68b3\u7406",
  DATA_CLEANING: "\u6570\u636e\u5904\u7406",
  DATA_CHECK: "\u6570\u636e\u68c0\u67e5",
  BASELINE_REGRESSION: "\u57fa\u51c6\u56de\u5f52"
};

const workflowAdvanceCopy: Record<string, string> = {
  TOPIC_DETECT: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u5e2e\u60a8\u8bc6\u522b\u5e76\u6536\u655b\u7814\u7a76\u4e3b\u9898\u3002",
  TOPIC_NORMALIZE: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u6574\u7406\u5e76\u786e\u8ba4\u7814\u7a76\u8bbe\u5b9a\u3002",
  SOP_GUIDE: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u4e3a\u60a8\u68b3\u7406\u7814\u7a76\u8def\u5f84\u3001\u53d8\u91cf\u6784\u5efa\u548c\u57fa\u51c6\u56de\u5f52\u601d\u8def\u3002",
  DATA_CLEANING: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u8fdb\u5165\u6570\u636e\u5904\u7406\u3002",
  DATA_CHECK: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u505a\u6570\u636e\u68c0\u67e5\u3002",
  BASELINE_REGRESSION: "\u63a5\u4e0b\u6765\u6211\u4f1a\u5148\u8fdb\u5165\u57fa\u51c6\u56de\u5f52\u3002"
};

export function sanitizeUserFacingWorkflowTerms(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return trimmed ?? "";
  }

  let text = trimmed;
  text = text.replace(
    /(?:topic_detect|TOPIC_DETECT)\s*->\s*(?:topic_normalize|TOPIC_NORMALIZE)\s*->\s*(?:sop_guide|SOP_GUIDE)\s*->\s*(?:data_cleaning|DATA_CLEANING)\s*->\s*(?:data_check|DATA_CHECK)\s*->\s*(?:baseline_regression|BASELINE_REGRESSION)/g,
    "\u4e3b\u9898\u786e\u8ba4 -> \u6570\u636e\u5904\u7406 -> \u57fa\u51c6\u56de\u5f52"
  );

  text = text.replace(
    /\u4e3b\u9898\u8bc6\u522b\u6b63\u786e[\uff0c,]?\s*\u7814\u7a76\u4e3b\u9898\u4e3a[\u201c\u300c"]?([^\u201d\u300d"]+)[\u201d\u300d"]?[\u3002.]?\s*\u5f53\u524d\u8fdb\u5165\s*(TOPIC_DETECT|TOPIC_NORMALIZE|SOP_GUIDE|DATA_CLEANING|DATA_CHECK|BASELINE_REGRESSION)\s*\u9636\u6bb5[\uff0c,]?\s*\u9700\u8981\u4e3a\u60a8\u751f\u6210\u6807\u51c6\u5316\u7684\u5b9e\u8bc1\u7814\u7a76\u64cd\u4f5c\u6d41\u7a0b\u6307\u5357[\u3002.]?/gi,
    (_, topic, step) => "\u6211\u5df2\u8bc6\u522b\u5230\u60a8\u7684\u7814\u7a76\u4e3b\u9898\u201c" + topic + "\u201d\u3002" + (workflowAdvanceCopy[String(step).toUpperCase()] ?? "\u63a5\u4e0b\u6765\u6211\u4f1a\u7ee7\u7eed\u5e2e\u60a8\u63a8\u8fdb\u7814\u7a76\u6d41\u7a0b\u3002")
  );

  text = text.replace(
    /(\u63a5\u4e0b\u6765\u5c06\u8fdb\u5165|\u5f53\u524d\u8fdb\u5165)\s*\*{0,2}(TOPIC_DETECT|TOPIC_NORMALIZE|SOP_GUIDE|DATA_CLEANING|DATA_CHECK|BASELINE_REGRESSION)\*{0,2}\s*\u9636\u6bb5/gi,
    (_, __, step) => workflowAdvanceCopy[String(step).toUpperCase()] ?? "\u63a5\u4e0b\u6765\u6211\u4f1a\u7ee7\u7eed\u63a8\u8fdb\u5f53\u524d\u7814\u7a76\u6d41\u7a0b\u3002"
  );

  text = text.replace(
    /\u5f53\u524d\u6a21\u5757(?:\u4e3a|\u662f)\s*[\u300c\u201c"]?\*{0,2}(TOPIC_DETECT|TOPIC_NORMALIZE|SOP_GUIDE|DATA_CLEANING|DATA_CHECK|BASELINE_REGRESSION)\*{0,2}[\u300d\u201d"]?/gi,
    (_, step) => "\u5f53\u524d\u8fd9\u4e00\u6b65\u662f\u300c" + (workflowTermLabels[String(step).toUpperCase()] ?? "\u7814\u7a76\u6d41\u7a0b") + "\u300d"
  );

  text = text.replace(/\u6807\u51c6\u5316\u7684\u5b9e\u8bc1\u7814\u7a76\u64cd\u4f5c\u6d41\u7a0b\u6307\u5357/g, "\u7814\u7a76\u8def\u5f84\u5efa\u8bae");
  text = text.replace(/\bworkflow\b/gi, "\u7814\u7a76\u6d41\u7a0b");

  for (const [term, label] of Object.entries(workflowTermLabels)) {
    text = text.replace(new RegExp('\\b' + term + '\\b', "g"), label);
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

export function sanitizeSkillOutputStrings<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeUserFacingWorkflowTerms(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSkillOutputStrings(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, sanitizeSkillOutputStrings(item)])
    ) as T;
  }

  return value;
}
export function buildGeneralResearchChatOutput(input: GeneralResearchChatInput): GeneralResearchChatOutput {
  const question = input.userQuestion.trim();
  const topicLead = input.topic ? `结合你当前的题目“${input.topic}”，` : "";

  if (looksLikePromptOnlyPunctuation(question)) {
    return {
      answer:
        "你想问什么？可以直接问我科研概念、变量设定、模型选择，也可以继续补充你的研究主题、研究对象、变量和样本区间。",
      keyPoints: [
        "如果是研究设定信息，我会帮你整理到当前项目里。",
        "如果是科研概念问题，我会先解释清楚，再提示下一步怎么用。"
      ],
      suggestedNextActions: [
        "例如：什么是研究对象？",
        "例如：研究主题是数字金融对企业创新的影响。"
      ]
    };
  }

  if (looksLikeSmallTalkOrOffTopic(question)) {
    return {
      answer:
        "我是经管实证论文助手，主要帮你梳理研究设定、变量口径、模型选择和后续 Stata 工作流。天气、闲聊这类问题我不展开回答。你可以告诉我研究主题、研究对象、解释变量、被解释变量、控制变量和样本区间，我会继续帮你整理。",
      keyPoints: [
        "我会优先处理和科研论文、实证研究、变量设定、数据字段相关的问题。",
        "如果你只是还没想好题目，可以先说一个大概方向，我会继续追问。"
      ],
      suggestedNextActions: [
        "先告诉我你想研究什么变量之间的关系。",
        "也可以问：什么叫研究对象？"
      ]
    };
  }

  if (/固定效应/.test(question)) {
    return {
      answer:
        `${topicLead}固定效应的作用是控制那些不随时间变化、但会影响结果变量的个体差异，以及共同时间冲击。双向固定效应通常表示同时控制个体固定效应和年份固定效应，这样更容易把核心解释变量的净影响识别出来。`,
      keyPoints: [
        "个体固定效应控制企业层面不随时间变化的遗漏因素。",
        "年份固定效应控制宏观冲击、政策周期和共同趋势。",
        "如果你的核心变量主要在企业和年份两个维度变化，双向固定效应通常是常见起点。"
      ],
      suggestedNextActions: [
        "明确个体维度和时间维度分别是什么。",
        "确认是否需要行业、地区等更细粒度固定效应。"
      ]
    };
  }

  if (/个体变量|面板.*id|panel\s*id|时间变量|年份变量|time\s*var|year/i.test(question)) {
    return {
      answer:
        `${topicLead}个体变量是面板数据里用来区分研究对象的字段，常见就是企业代码、股票代码或公司 id；时间变量是区分年份或季度的字段，常见就是 year。没有特别说明时，可以先把个体变量理解为 stkcd，时间变量理解为 year，后续再按数据字段映射调整。`,
      keyPoints: [
        "个体变量回答“是哪一个企业/样本主体”。",
        "时间变量回答“是哪一年或哪一期”。",
        "二者一起决定一条面板观测，例如 stkcd-year。"
      ],
      suggestedNextActions: [
        "如果你的数据字段里有股票代码和年份，可以先分别映射为 stkcd 和 year。"
      ]
    };
  }

  if (/控制变量/.test(question)) {
    return {
      answer:
        `${topicLead}控制变量的核心目标是尽量缓解遗漏变量偏误。经管实证里，通常优先纳入会同时影响核心解释变量和结果变量的企业特征、财务特征与治理特征，而不是机械堆变量。`,
      keyPoints: [
        "优先选择文献中常见且理论上相关的控制变量。",
        "控制变量需要有清晰口径，避免和核心解释变量高度重合。",
        "最终模型里变量数量要和样本量、共线性风险一起考虑。"
      ],
      suggestedNextActions: [
        "先列出 5 到 8 个最常见控制变量。",
        "逐个确认变量定义、计算方式和数据来源。"
      ]
    };
  }

  if (/内生性/.test(question)) {
    return {
      answer:
        `${topicLead}内生性通常来自反向因果、遗漏变量或测量误差。处理顺序一般不是一上来就做 IV，而是先把基准回归、固定效应、控制变量和稳健性检验做好，再决定是否需要更强的识别策略。`,
      keyPoints: [
        "先判断内生性来源，再选处理方法。",
        "常见方法包括工具变量、滞后项、双重差分或自然实验。",
        "如果识别策略解释不清，方法再复杂也站不住。"
      ],
      suggestedNextActions: [
        "先说明你最担心的是哪一种内生性。",
        "再看当前题目有没有合适的外生冲击或工具变量。"
      ]
    };
  }

  if (/稳健性/.test(question)) {
    return {
      answer:
        `${topicLead}稳健性检验的核心不是重复做回归，而是验证你的主结论是否依赖某个特定口径、样本或模型设定。只要主结论在合理替代设定下仍然成立，论文说服力就会强很多。`,
      keyPoints: [
        "可以从替换变量、缩尾样本、替代模型三个方向展开。",
        "稳健性方案要和主假设保持一致，不能为了做而做。",
        "每一种稳健性检验都需要解释它在排除什么担忧。"
      ],
      suggestedNextActions: [
        "先列出你主回归里最脆弱的一项设定。",
        "围绕这项设定设计 2 到 3 个替代检验。"
      ]
    };
  }

  if (/机制/.test(question)) {
    return {
      answer:
        `${topicLead}机制分析的重点是说明核心解释变量为什么会影响结果变量，也就是把“是否有效”推进到“为何有效”。常见做法是找到一个能代表中介渠道的变量，再检验核心解释变量是否先影响这个中介变量。`,
      keyPoints: [
        "机制变量必须和理论链条一一对应。",
        "先写清理论路径，再决定用中介回归还是分组检验。",
        "机制分析不是简单多加一个变量，而是验证作用路径。"
      ],
      suggestedNextActions: [
        "先用一句话写出你的理论机制。",
        "再找能量化这个渠道的代理变量。"
      ]
    };
  }

  return {
    answer:
      `${topicLead}这个问题可以从研究设计、变量构建和识别策略三个层面来理解。先把问题放回你当前的论文框架里，明确它影响的是题目设定、数据处理，还是后续回归识别，再决定下一步该补什么信息。`,
    keyPoints: [
      "先判断这是概念问题、变量问题还是识别问题。",
      "尽量把提问和当前题目、样本、变量设定挂钩。",
      "如果问题和当前步骤直接相关，优先补足能推进下一步的信息。"
    ],
    suggestedNextActions: [
      "可以继续追问得更具体一些，例如某个变量、模型或识别策略。"
    ]
  };
}

const interpreterConfirmWords = new Set([
  "yes",
  "ok",
  "okay",
  "confirm",
  "confirmed",
  "sure",
  "\u662f",
  "\u662f\u7684",
  "\u597d",
  "\u597d\u7684",
  "\u884c",
  "\u53ef\u4ee5",
  "\u786e\u8ba4",
  "\u786e\u8ba4\u4e3b\u9898"
]);

function normalizeIntentText(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s,\uFF0C\u3002.!?\uFF01\uFF1F;\uFF1B:\uFF1A]/g, "");
}

function splitItems(value: string) {
  return value
    .replace(/[，、；]/g, ",")
    .split(/[\s,\/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const METHOD_NEGATION = {
  did: /(?:不做|暂时不做|先不做|不使用|不用|不需要|无需|没有计划做|暂不考虑).{0,12}(?:DID|双重差分)/i,
  psm: /(?:不做|暂时不做|先不做|不使用|不用|不需要|无需|没有计划做|暂不考虑).{0,12}(?:PSM|倾向得分匹配)/i,
  iv: /(?:不做|暂时不做|先不做|不使用|不用|不需要|无需|没有计划做|暂不考虑).{0,12}(?:IV|工具变量|工具变量法)/i
};

export function wantsSetupExampleInput(text: string) {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    /不知道.*(主题|开始|输入|怎么用|做什么)|没想好|还没想好|随便.*(例子|示例|主题)|给我.*(例子|示例)|举个例子|怎么输入|这个怎么用|如何使用/.test(text) ||
    /^(你好|您好|在吗|哈喽|嗨|hi|hello|hey|随便|随便聊|闲聊|ok|okay)$/.test(normalized)
  );
}

function normalizeExportFormats(value: string) {
  const normalized = new Set<string>();
  for (const item of splitItems(value)) {
    const compact = item.toLowerCase().replace(/[\s_-]+/g, "");
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
  }
  return Array.from(normalized);
}

function splitFixedEffectItems(value: string) {
  return value
    .replace(/[\uFF0C\u3001\uFF1B]/g, ",")
    .split(/(?:[\s,\/+]|\u548c|\u4e0e|\u53ca)+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeFixedEffectToken(value: string) {
  const raw = cleanTerm(value);
  const compact = raw.toLowerCase().replace(/\s+/g, "");
  if (!compact) {
    return [] as string[];
  }

  if (/\u53cc(?:\u5411|\u91cd)?\u56fa\u5b9a\u6548\u5e94|two[- ]?wayfixedeffects?|two[- ]?wayfe/.test(compact)) {
    return ["\u4f01\u4e1a\u56fa\u5b9a\u6548\u5e94", "\u5e74\u4efd\u56fa\u5b9a\u6548\u5e94"];
  }

  const labels = new Set<string>();

  if (/(\u4f01\u4e1a|\u516c\u53f8|\u4e2a\u4f53|\u4e3b\u4f53|firm|company|entity|firm_id|^id$)/i.test(raw)) {
    labels.add("\u4f01\u4e1a\u56fa\u5b9a\u6548\u5e94");
  }
  if (/(\u5e74\u4efd|\u65f6\u95f4|year|time)/i.test(raw) || compact === "\u5e74") {
    labels.add("\u5e74\u4efd\u56fa\u5b9a\u6548\u5e94");
  }
  if (/(\u884c\u4e1a|industry)/i.test(raw)) {
    labels.add("\u884c\u4e1a\u56fa\u5b9a\u6548\u5e94");
  }
  if (/(\u5730\u533a|\u533a\u57df|region)/i.test(raw)) {
    labels.add("\u5730\u533a\u56fa\u5b9a\u6548\u5e94");
  }
  if (/(\u7701\u4efd|province)/i.test(raw) || compact === "\u7701") {
    labels.add("\u7701\u4efd\u56fa\u5b9a\u6548\u5e94");
  }
  if (/(\u57ce\u5e02|city)/i.test(raw) || compact === "\u5e02") {
    labels.add("\u57ce\u5e02\u56fa\u5b9a\u6548\u5e94");
  }

  if (labels.size > 0) {
    return Array.from(labels);
  }

  if (/\u56fa\u5b9a\u6548\u5e94|fixedeffects?|\bfe\b/i.test(raw)) {
    return raw.length <= 20 ? [raw] : [];
  }

  if (/^\d+$/.test(raw) || raw === "月" || raw.length > 8 || /(研究|样本|变量|模型|结果|证据|影响|检验|机制|基础|路径|治理|实践)/u.test(raw)) {
    return [];
  }

  return [raw.endsWith("\u56fa\u5b9a\u6548\u5e94") ? raw : `${raw}\u56fa\u5b9a\u6548\u5e94`];
}

export function normalizeFixedEffects(value?: string | string[] | null) {
  const rawText = Array.isArray(value) ? value.join("\u3001") : value ?? "";
  const text = rawText.trim();
  if (!text) {
    return [] as string[];
  }

  const normalized = new Set<string>();
  if (/\u53cc(?:\u5411|\u91cd)?\u56fa\u5b9a\u6548\u5e94|two[- ]?way\s*fixed\s*effects?|two[- ]?way\s*fe/i.test(text)) {
    normalized.add("\u4f01\u4e1a\u56fa\u5b9a\u6548\u5e94");
    normalized.add("\u5e74\u4efd\u56fa\u5b9a\u6548\u5e94");
  }

  const items = Array.isArray(value)
    ? value.flatMap((item) => splitFixedEffectItems(String(item)))
    : splitFixedEffectItems(text);

  for (const item of items.length > 0 ? items : [text]) {
    for (const label of normalizeFixedEffectToken(item)) {
      normalized.add(label);
    }
  }

  return Array.from(normalized);
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const value = text.match(pattern)?.[1]?.trim();
    if (value) {
      return value.replace(/^[=:\uFF1A]/, "").trim();
    }
  }

  return "";
}

function buildFieldPattern(labels: string[]) {
  const joined = labels.join("|");
  return new RegExp(
    // 中文句号、问号和感叹号都作为字段边界，避免“时间变量为 year。标准误...”吞并后续句子。
    String.raw`(?:${joined})(?:\s*(?::|\uFF1A|=)\s*|\s*(?:\u662f|\u4e3a|\u6539\u6210|\u6539\u4e3a|\u6362\u6210)\s*)([^\n\r,\uFF0C;\uFF1B\u3002.!?\uFF01\uFF1F]+)`,
    "i"
  );
}

function normalizeResearchInputText(value: string) {
  const inlineNormalized = value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/([A-Za-z])[ \t]+([\u4e00-\u9fff])/g, "$1$2")
    .replace(/([\u4e00-\u9fff])[ \t]+([A-Za-z])/g, "$1$2")
    .replace(/([\u4e00-\u9fff])[ \t]+([\u4e00-\u9fff])/g, "$1$2")
    .replace(/((?:19|20)\d{2})\s*年?\s*(?:-|~|\uFF5E|\u301C|\u2013|\u2014|至|到)\s*((?:19|20)\d{2})\s*年?/g, "$1到$2年")
    .replace(/深沪A股/g, "沪深A股")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const lines: string[] = [];
  for (const rawLine of inlineNormalized.split("\n")) {
    const line = rawLine.trimEnd();
    const previous = lines[lines.length - 1];
    const trimmed = line.trimStart();

    if (
      previous &&
      trimmed &&
      !previous.includes("|") &&
      !trimmed.includes("|") &&
      !/[。；;：:!?！？]$/.test(previous.trim()) &&
      !/^(工作表|CASE|=|#|[一二三四五六七八九十]、|（[一二三四五六七八九十]|[0-9]+[.)、]|•)/u.test(trimmed)
    ) {
      lines[lines.length - 1] = `${previous.trimEnd()}${trimmed}`;
    } else {
      lines.push(line);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function inferYearRange(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return "";
  }

  const match = trimmed.match(
    /(?:^|(?:\u6837\u672c|\u7814\u7a76|\u6570\u636e|\u65f6\u95f4|\u5e74\u4efd|\u9009\u62e9).{0,24})((?:19|20)\d{2})\s*\u5e74?\s*(?:-|~|\uFF5E|\u301C|\u2013|\u2014|\u81F3|\u5230)\s*((?:19|20)\d{2})\s*\u5e74?/i
  );
  if (!match) {
    return "";
  }

  return `${match[1]}\u2013${match[2]}\u5e74`;
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function cleanVariableName(value: string) {
  return value
    .replace(/^(?:以及|和|与|其中)\s*/u, "")
    .replace(/(?:作为.*|衡量.*|可以.*|采用.*)$/u, "")
    .replace(/[。；;,，、\s]+$/u, "")
    .trim();
}

function parseVariableList(value: string) {
  const segments = value
    .replace(/以及|和|与/g, "、")
    .split(/[、，,；;]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return uniqueStrings(
    segments.map((segment) => {
      const codes = segment.match(/\b[A-Za-z][A-Za-z0-9_]*\b/g);
      if (codes?.length) {
        return codes[codes.length - 1];
      }
      return cleanVariableName(segment);
    })
  );
}

function inferShortTopicTitle(text: string, updates: WorkflowInputInterpreterProfilePatch) {
  const firstSentence = text.split(/[。.!?\n]/)[0]?.trim() ?? "";
  const explicitImpactTopic = text.match(
    /(?:我想研究|研究主题(?:是|为|：|:)?|题目(?:是|为|：|:)?)([^。；;，,\n]{1,50}?对[^。；;，,\n]{1,50}?(?:影响|作用|效应|关系))/
  )?.[1]?.trim();
  if (explicitImpactTopic) {
    return explicitImpactTopic.endsWith("研究") ? explicitImpactTopic : `${explicitImpactTopic}研究`;
  }

  const topicPhrase = firstSentence.match(/(?:我想研究|研究主题(?:是|为|：|:)?|题目(?:是|为|：|:)?)(.+)$/)?.[1]?.trim() ?? "";
  const candidate = cleanTerm(topicPhrase || firstSentence)
    .replace(/^本文(?:选择|研究)/, "")
    .replace(/^(我想|想)?研究/, "")
    .replace(/(?:的)?影响$/, "的影响研究")
    .replace(/(?:的)?效应$/, "的效应研究")
    .replace(/(?:的)?关系$/, "的关系研究")
    .trim();

  const candidateWithoutMethodTerms = candidate.replace(/固定效应|双向固定效应|面板固定效应/g, "");
  if (candidate && /对|影响|效应|关系/.test(candidateWithoutMethodTerms) && candidate.length <= 40) {
    return candidate.endsWith("研究") ? candidate : `${candidate}研究`;
  }

  if (updates.independentVariable && updates.dependentVariable) {
    const x = updates.independentVariable.replace(/水平$/u, "");
    const y = updates.dependentVariable.replace(/^企业/u, "");
    return `${x}对${y}的影响研究`;
  }

  return "";
}

function inferResearchObjectFromText(text: string) {
  const yearPrefix = /(?:19|20)\d{2}\s*\u5e74?\s*(?:-|~|\uFF5E|\u301C|\u2013|\u2014|\u81F3|\u5230)\s*(?:19|20)\d{2}\s*\u5e74?/;
  const sampleMatch = text.match(new RegExp(`${yearPrefix.source}\\s*([^。；;，,]+?)(?:为研究样本|作为研究样本|为样本|样本)`, "i"));
  const sample = sampleMatch?.[1]?.trim() ?? "";
  const exclusions = text.match(/(?:删除|剔除)([^。；;]+?)(?:的)?样本/)?.[1]?.trim() ?? "";
  const normalizedSample = sample.replace(/^的?/, "").replace(/本文选择|选择/g, "").trim();
  const normalizedExclusions = exclusions.replace(/以及/g, "、").replace(/的$/u, "").trim();

  if (normalizedSample && normalizedExclusions) {
    return `${normalizedSample}，剔除${normalizedExclusions}样本`;
  }

  if (normalizedSample) {
    return normalizeResearchObject(normalizedSample);
  }

  return "";
}

function inferControlsFromText(text: string) {
  const raw = text.match(
    /控制变量(?:包括|有|就|是|为|放|放入|：|:)\s*([\s\S]+?)(?=(?:，|,)?\s*(?:时间|样本|固定效应|研究对象|面板|聚类)\s*(?:是|为|:|：)|[。；;\n]|$)/
  )?.[1]?.trim() ?? "";
  return raw ? parseVariableList(raw.replace(/这些$/u, "")) : [];
}

function cleanFixedEffectsCandidate(value: string) {
  if (/双(?:向|重)?固定效应|two[- ]?way\s*(?:fixed\s*effects?|\bfe\b)/i.test(value)) {
    return "双向固定效应";
  }

  return value
    .replace(/^(?:固定效应(?:采用|加入|控制|使用|为|是)?|采用|加入|控制|使用|本文采用|在控制)\s*/u, "")
    .split(/(?:，|,|。|；|;|的基础|基础上|控制不可观测|用于|检验|为企业|为本文)/u)[0]
    ?.trim() ?? "";
}

function inferFixedEffectsFromText(text: string) {
  const sentences = text
    .split(/[。；;\n]/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /固定效应|fixed\s*effects?|\bFE\b/i.test(sentence));

  const preferred =
    sentences.find((sentence) => /固定效应(?:采用|为|是|：|:)|(?:采用|加入|控制|使用).{0,20}固定效应|双(?:向|重)?固定效应/i.test(sentence)) ??
    sentences.find((sentence) => /企业固定效应.{0,12}年份固定效应|公司固定效应.{0,12}年份固定效应/i.test(sentence)) ??
    "";

  return preferred ? cleanFixedEffectsCandidate(preferred) : "";
}

function inferMechanismVariablesFromText(text: string) {
  const section = text.match(/(?:机制变量方面|机制变量包括|中介变量包括|机制分析)([\s\S]+?)(?=控制变量|固定效应|异质性|样本|$)/)?.[1] ?? "";
  if (!section) {
    return [];
  }

  const values: string[] = [];
  for (const pattern of [/\b([A-Za-z][A-Za-z0-9_]*)\b\s*的代理变量/g, /得到\s*\b([A-Za-z][A-Za-z0-9_]*)\b/g]) {
    for (const match of section.matchAll(pattern)) {
      if (match[1]) {
        values.push(match[1]);
      }
    }
  }
  for (const code of section.match(/\b[A-Za-z][A-Za-z0-9_]*\b/g) ?? []) {
    if (!/^(DID|PSM|IV|FE|ROA|ESG)$/i.test(code)) {
      values.push(code);
    }
  }

  return uniqueStrings(values);
}

function extractCodeLikeValue(value: string) {
  return value.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/)?.[0] ?? "";
}

function inferSampleObjectFromTableValue(value: string) {
  const range = inferYearRange(value);
  return value
    .replace(/(?:19|20)\d{2}\s*年?\s*(?:-|~|\uFF5E|\u301C|\u2013|\u2014|至|到)\s*(?:19|20)\d{2}\s*年?/g, "")
    .replace(/[；;].*$/u, "")
    .replace(/本测试数据.*/u, "")
    .replace(/^[:：|\s]+/u, "")
    .replace(/；$/u, "")
    .trim() || (range ? "" : value.trim());
}

function inferTopicProfileFromValue(value: string) {
  const topic = inferShortTopicTitle(value, {});
  if (topic) {
    const normalized = normalizeTopic(topic);
    return {
      ...normalized,
      normalizedTopic: topic
    };
  }

  return normalizeTopic(value);
}

function inferTableProfileUpdates(text: string): WorkflowInputInterpreterProfilePatch {
  const updates: WorkflowInputInterpreterProfilePatch = {};
  const controls: string[] = [];
  const mechanismVariables: string[] = [];

  for (const line of text.split("\n")) {
    if (!line.includes("|")) {
      continue;
    }

    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2) {
      continue;
    }

    const [key, value = ""] = cells;
    const rowText = cells.slice(1).join(" ");

    if (/^(字段名|用途|工作表|文件名|类型|大小|来源|内容已完整解析|内容较长)$/u.test(key)) {
      continue;
    }

    if (/^(测试主题|研究主题|主题|题目)$/u.test(key)) {
      const topic = inferTopicProfileFromValue(value);
      updates.normalizedTopic ||= topic.normalizedTopic;
      updates.independentVariable ||= topic.independentVariable;
      updates.dependentVariable ||= topic.dependentVariable;
      continue;
    }

    if (/^(样本设定|样本区间|样本范围|研究对象)$/u.test(key)) {
      updates.sampleScope ||= inferYearRange(value);
      const object = inferSampleObjectFromTableValue(value);
      if (object) {
        updates.researchObject ||= normalizeResearchObject(object);
      }
      continue;
    }

    if (/^固定效应/u.test(key)) {
      const fixedEffects = normalizeFixedEffects(value);
      if (fixedEffects.length) {
        updates.fixedEffects = fixedEffects;
      }
      continue;
    }

    if (/^面板个体变量/u.test(key)) {
      const panelId = extractCodeLikeValue(value);
      if (panelId) {
        updates.panelId = panelId;
      }
      continue;
    }

    if (/^时间变量/u.test(key)) {
      const timeVar = extractCodeLikeValue(value);
      if (timeVar) {
        updates.timeVar = timeVar;
      }
      continue;
    }

    if (/^聚类变量/u.test(key)) {
      const clusterVar = extractCodeLikeValue(value);
      if (clusterVar) {
        updates.clusterVar = clusterVar;
      }
      continue;
    }

    const variableName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : "";
    if (!variableName) {
      continue;
    }

    if (/被解释变量|因变量|结果变量/u.test(rowText)) {
      updates.dependentVariable = variableName;
    } else if (/(?:核心)?解释变量|自变量/u.test(rowText)) {
      updates.independentVariable = variableName;
    }

    if (/控制变量/u.test(rowText)) {
      controls.push(variableName);
    }
    if (/机制变量|中介变量/u.test(rowText)) {
      mechanismVariables.push(variableName);
    }
    if (/面板个体变量|公司代码|股票代码/u.test(rowText)) {
      updates.panelId ||= variableName;
    }
    if (/时间变量|年份/u.test(rowText)) {
      updates.timeVar ||= variableName;
    }
    if (/聚类变量/u.test(rowText)) {
      updates.clusterVar ||= variableName;
    }
  }

  if (controls.length) {
    updates.controls = uniqueStrings(controls);
  }
  if (mechanismVariables.length) {
    updates.mechanismVariables = uniqueStrings(mechanismVariables);
  }

  return updates;
}

function inferDictionarySentenceUpdates(text: string): WorkflowInputInterpreterProfilePatch {
  const updates: WorkflowInputInterpreterProfilePatch = {};
  const controls: string[] = [];
  const mechanismVariables: string[] = [];
  const isDictionaryInput = /上传的数据|数据里|变量字典|字段表|字段名|工作表/u.test(text);

  const explicitDependentCode = text.match(/被解释变量\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:表示|为|是)/)?.[1];
  if (explicitDependentCode) {
    updates.dependentVariable = explicitDependentCode;
  }

  const explicitIndependentCode = text.match(/(?:核心)?解释变量\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:表示|为|是)/)?.[1];
  if (explicitIndependentCode) {
    updates.independentVariable = explicitIndependentCode;
  }

  for (const match of text.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\b\s*(?:是|为|表示)\s*([^。；;\n，,]+)/g)) {
    const variableName = match[1] ?? "";
    const description = match[2] ?? "";
    if (!variableName || !description) {
      continue;
    }

    if (/公司代码|股票代码|证券代码|个体变量|面板个体/u.test(description)) {
      updates.panelId ||= variableName;
    }
    if (/年份|年度|时间变量|时间维度/u.test(description)) {
      updates.timeVar ||= variableName;
    }
    if (/被解释变量|因变量|结果变量/u.test(description) || (isDictionaryInput && /ESG评级|ESG表现/u.test(description))) {
      updates.dependentVariable ||= variableName;
    }
    if (/核心解释变量|解释变量|自变量/u.test(description) || (isDictionaryInput && /创新水平|数字化/u.test(description))) {
      updates.independentVariable ||= variableName;
    }
    if (/信贷|融资约束|风险承担|机制变量|中介变量/u.test(description)) {
      mechanismVariables.push(variableName);
    }
  }

  for (const match of text.matchAll(/((?:\b[A-Za-z_][A-Za-z0-9_]*\b(?:、|,|，|和|\s+和\s+|\s+)?){2,})\s*(?:是|为|表示)\s*([^。；;\n，,]+)/g)) {
    const variableNames = match[1]?.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? [];
    const description = match[2] ?? "";
    if (/信贷|融资约束|风险承担|机制变量|中介变量/u.test(description)) {
      mechanismVariables.push(...variableNames);
    }
  }

  for (const match of text.matchAll(/((?:\b[A-Za-z_][A-Za-z0-9_]*\b(?:\s*、\s*|\s*,\s*|\s*，\s*|\s*和\s*)?){2,})(?:是|为)(?:融资约束|风险承担|机制变量|中介变量)/g)) {
    mechanismVariables.push(...(match[1]?.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? []));
  }

  for (const match of text.matchAll(/\b(Risk\d+)\b\s*和\s*\b(Risk\d+)\b\s*(?:是|为|表示)?\s*风险承担/g)) {
    mechanismVariables.push(match[1], match[2]);
  }

  for (const match of text.matchAll(/((?:\b[A-Za-z_][A-Za-z0-9_]*\b(?:、|,|，|和|\s+和\s+|\s+)?){2,})\s*(?:是|为)\s*控制变量/g)) {
    controls.push(...(match[1]?.match(/\b[A-Za-z_][A-Za-z0-9_]*\b/g) ?? []));
  }

  if (!updates.normalizedTopic && /企业创新|创新水平|Innov/i.test(text) && /ESG表现|ESG评级|\bESG\b/i.test(text)) {
    updates.normalizedTopic = "企业创新对ESG表现的影响研究";
    updates.independentVariable ||= isDictionaryInput && /\bInnov\b/.test(text) ? "Innov" : "企业创新水平";
    updates.dependentVariable ||= isDictionaryInput && /\bESG\b/.test(text) ? "ESG" : "企业ESG表现";
  }

  if (controls.length) {
    updates.controls = uniqueStrings(controls);
  }
  if (mechanismVariables.length) {
    updates.mechanismVariables = uniqueStrings(mechanismVariables);
  }

  return updates;
}

function looksLikeWorkflowQuestion(text: string) {
  if (/[?\uFF1F]/.test(text)) {
    return true;
  }

  return /^(what|why|how|can|could|would|should|is|are|do|does|did|\u4ec0\u4e48|\u4e3a\u4ec0\u4e48|\u600e\u4e48|\u5982\u4f55|\u4e3a\u5565|\u80fd\u4e0d\u80fd|\u53ef\u4e0d\u53ef\u4ee5|\u662f\u5426|\u6709\u6ca1\u6709|\u8bf7\u95ee)/i.test(text.trim());
}

function looksLikePromptOnlyPunctuation(text: string) {
  const trimmed = text.trim();
  return Boolean(trimmed) && /^[\p{P}\p{S}]+$/u.test(trimmed);
}

function looksLikeSmallTalkOrOffTopic(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  if (looksLikePromptOnlyPunctuation(trimmed)) {
    return true;
  }

  return /^(\u4f60\u597d|\u55e8|hi|hello|hey|\u5728\u5417|\u8c22\u8c22|\u8c22\u4e86|\u65e9\u4e0a\u597d|\u665a\u4e0a\u597d)$/i.test(trimmed)
    || /(\u4eca\u5929|\u660e\u5929|\u6628\u5929).{0,6}(\u5929\u6c14|\u51e0\u70b9|\u65f6\u95f4|\u661f\u671f)|\u8bb2\u4e2a\u7b11\u8bdd|\u5531\u9996\u6b4c|\u4f60\u662f\u8c01/i.test(trimmed);
}

export function inferProfileUpdates(text: string): WorkflowInputInterpreterProfilePatch {
  text = normalizeResearchInputText(text);
  const updates: WorkflowInputInterpreterProfilePatch = {};

  const independentVariable = firstMatch(text, [
    buildFieldPattern(["\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf", "\u81ea\u53d8\u91cf"]),
    buildFieldPattern(["independent variable", "x variable"])
  ]) || text.match(/(?:^|[。；;，,\n\r])\s*(?:核心)?解释变量(?:\s*(?::|\uFF1A|=)\s*|\s*(?:是|为)\s*)([^\n\r,\uFF0C;\uFF1B\u3002.!?\uFF01\uFF1F]+)/)?.[1]?.trim() || "";
  if (independentVariable) {
    updates.independentVariable = independentVariable;
  }

  const dependentVariable = firstMatch(text, [
    buildFieldPattern(["\u88ab\u89e3\u91ca\u53d8\u91cf", "\u56e0\u53d8\u91cf", "\u7ed3\u679c\u53d8\u91cf"]),
    buildFieldPattern(["dependent variable", "y variable"])
  ]);
  if (dependentVariable) {
    updates.dependentVariable = dependentVariable;
  }

  const researchObject = firstMatch(text, [
    buildFieldPattern(["\u7814\u7a76\u5bf9\u8c61", "\u6837\u672c", "\u7814\u7a76\u6837\u672c"]),
    buildFieldPattern(["research object", "sample"])
  ]);
  if (researchObject) {
    updates.researchObject = normalizeResearchObject(researchObject);
  }
  updates.researchObject ||= inferResearchObjectFromText(text);

  const relationship = firstMatch(text, [
    buildFieldPattern(["\u5173\u7cfb\u7c7b\u578b", "\u4f5c\u7528\u65b9\u5411", "\u5047\u8bbe\u65b9\u5411"]),
    buildFieldPattern(["relationship", "effect direction"])
  ]);
  if (relationship) {
    updates.relationship = relationship;
  }

  const normalizedTopic = firstMatch(text, [
    buildFieldPattern(["\u6807\u51c6\u5316\u9898\u76ee", "\u9898\u76ee", "\u4e3b\u9898"]),
    buildFieldPattern(["topic", "title"])
  ]);
  if (normalizedTopic && normalizedTopic.length >= 4) {
    updates.normalizedTopic = normalizedTopic;
  }
  updates.normalizedTopic ||= inferShortTopicTitle(text, updates);

  const controlsRaw = firstMatch(text, [
    buildFieldPattern(["\u63a7\u5236\u53d8\u91cf", "\u63a7\u5236\u53d8\u91cf\u5217\u8868"]),
    buildFieldPattern(["controls", "control variables"])
  ]) || inferControlsFromText(text).join("、");
  if (controlsRaw) {
    updates.controls = parseVariableList(controlsRaw);
  }

  const fixedEffectsRaw = firstMatch(text, [
    buildFieldPattern(["\u56fa\u5b9a\u6548\u5e94", "\u56fa\u5b9a\u6548\u5e94\u8bbe\u5b9a"]),
    buildFieldPattern(["fixed effects", "fe"])
  ]) || inferFixedEffectsFromText(text);
  if (fixedEffectsRaw) {
    updates.fixedEffects = normalizeFixedEffects(fixedEffectsRaw);
  }

  const clusterVar = firstMatch(text, [
    buildFieldPattern(["\u805a\u7c7b\u53d8\u91cf", "\u805a\u7c7b\u6807\u51c6\u8bef"]),
    buildFieldPattern(["cluster variable", "cluster var"])
  ]) || text.match(/按\s*([A-Za-z_][A-Za-z0-9_]*)\s*聚类/i)?.[1] || "";
  if (clusterVar) {
    updates.clusterVar = clusterVar;
  }

  const panelId = firstMatch(text, [
    buildFieldPattern(["\u9762\u677f\u4e2a\u4f53\u53d8\u91cf", "\u9762\u677f\u4e3b\u4f53", "\u9762\u677fid", "\u9762\u677f id", "\u4e2a\u4f53\u53d8\u91cf", "\u4e2a\u4f53id", "\u4e2a\u4f53 id", "\u4f01\u4e1aid", "\u4f01\u4e1a id", "\u516c\u53f8\u4ee3\u7801"]),
    buildFieldPattern(["panel id", "entity id", "firm id"])
  ]);
  if (panelId) {
    updates.panelId = panelId;
  }

  const timeVar = firstMatch(text, [
    buildFieldPattern(["\u65f6\u95f4\u53d8\u91cf", "\u5e74\u4efd\u53d8\u91cf", "\u65f6\u95f4\u7ef4\u5ea6"]),
    buildFieldPattern(["time variable", "year variable", "time var"])
  ]);
  if (timeVar) {
    updates.timeVar = timeVar;
  }

  const sampleScope = firstMatch(text, [
    buildFieldPattern([
      "\u6837\u672c\u8303\u56f4",
      "\u6837\u672c\u533a\u95f4",
      "\u6837\u672c\u671f\u95f4",
      "\u6837\u672c\u5e74\u4efd",
      "\u7814\u7a76\u533a\u95f4",
      "\u7814\u7a76\u671f\u95f4",
      "\u7814\u7a76\u5e74\u4efd",
      "\u6570\u636e\u533a\u95f4",
      "\u6570\u636e\u5e74\u4efd",
      "\u6570\u636e\u65f6\u95f4\u8303\u56f4",
      "\u65f6\u95f4\u8303\u56f4",
      "\u65f6\u95f4\u533a\u95f4",
      "\u5e74\u4efd\u8303\u56f4"
    ]),
    buildFieldPattern(["sample scope", "time range", "sample range", "research period", "sample period"])
  ]) || inferYearRange(text);
  if (sampleScope) {
    updates.sampleScope = sampleScope;
  }

  const didDisabled = METHOD_NEGATION.did.test(text);
  const psmDisabled = METHOD_NEGATION.psm.test(text);
  const ivDisabled = METHOD_NEGATION.iv.test(text);

  if (didDisabled) {
    updates.didEnabled = false;
  } else if (/\bDID\b|\u653f\u7b56\u51b2\u51fb|\u5904\u7406\u7ec4|\u5bf9\u7167\u7ec4|\u653f\u7b56\u5e74\u4efd/i.test(text)) {
    updates.didEnabled = true;
  }

  if (psmDisabled) {
    updates.psmEnabled = false;
  } else if (/\bPSM\b|\u503e\u5411\u5f97\u5206|\u5339\u914d/i.test(text)) {
    updates.psmEnabled = true;
  }

  const treatmentVar = firstMatch(text, [
    buildFieldPattern(["DID\u5904\u7406\u7ec4\u53d8\u91cf", "PSM\u5904\u7406\u53d8\u91cf", "\u5904\u7406\u7ec4\u53d8\u91cf", "\u5904\u7406\u53d8\u91cf", "treat\u53d8\u91cf"]),
    buildFieldPattern(["treatment variable", "treat var"])
  ]);
  if (treatmentVar) {
    updates.treatmentVar = treatmentVar;
  }
  if (didDisabled && psmDisabled) {
    delete updates.treatmentVar;
  }

  const policyTimeVar = firstMatch(text, [
    buildFieldPattern(["\u653f\u7b56\u65f6\u95f4\u53d8\u91cf", "\u653f\u7b56\u5e74\u4efd\u53d8\u91cf"]),
    buildFieldPattern(["policy time variable", "policy year variable"])
  ]);
  if (policyTimeVar) {
    updates.policyTimeVar = policyTimeVar;
  }

  const policyStartYear = firstMatch(text, [
    buildFieldPattern(["\u653f\u7b56\u53d1\u751f\u5e74\u4efd", "\u653f\u7b56\u5e74\u4efd", "\u653f\u7b56\u65f6\u95f4"]),
    buildFieldPattern(["policy year", "policy start year"])
  ]) || text.match(/(?:\u653f\u7b56|\u8bd5\u70b9|\u51b2\u51fb).{0,8}((?:19|20)\d{2})\s*\u5e74?/)?.[1] || "";
  if (policyStartYear) {
    updates.policyStartYear = policyStartYear;
  }

  const instrumentVariable = firstMatch(text, [
    buildFieldPattern(["\u5de5\u5177\u53d8\u91cf", "IV\u53d8\u91cf"]),
    buildFieldPattern(["instrument variable", "instrumental variable", "iv variable"])
  ]);
  if (instrumentVariable) {
    updates.instrumentVariable = instrumentVariable;
  }
  if (ivDisabled) {
    updates.instrumentVariable = null;
  }

  const psmMatchVars = firstMatch(text, [
    buildFieldPattern(["PSM\u5339\u914d\u53d8\u91cf", "\u5339\u914d\u53d8\u91cf"]),
    buildFieldPattern(["matching variables", "psm variables"])
  ]);
  if (psmMatchVars) {
    updates.psmMatchVars = splitItems(psmMatchVars);
  }
  if (psmDisabled) {
    delete updates.psmMatchVars;
  }

  const mechanismVariables = firstMatch(text, [
    buildFieldPattern(["\u673a\u5236\u53d8\u91cf", "\u4e2d\u4ecb\u53d8\u91cf"]),
    buildFieldPattern(["mechanism variables", "mediator variables"])
  ]) || inferMechanismVariablesFromText(text).join("、");
  if (mechanismVariables) {
    updates.mechanismVariables = parseVariableList(mechanismVariables);
  }

  const heterogeneityVars = firstMatch(text, [
    buildFieldPattern(["\u5f02\u8d28\u6027\u53d8\u91cf", "\u5206\u7ec4\u53d8\u91cf", "\u8c03\u8282\u53d8\u91cf"]),
    buildFieldPattern(["heterogeneity variables", "group variables", "moderator variables"])
  ]);
  if (heterogeneityVars) {
    updates.heterogeneityVars = splitItems(heterogeneityVars);
  }

  const exportFormats = firstMatch(text, [
    buildFieldPattern(["\u5bfc\u51fa\u683c\u5f0f", "\u8f93\u51fa\u683c\u5f0f"]),
    buildFieldPattern(["export formats", "output formats"])
  ]);
  const normalizedExportFormats = normalizeExportFormats(exportFormats);
  if (normalizedExportFormats.length > 0) {
    updates.exportFormats = normalizedExportFormats as Array<"word" | "latex" | "excel" | "stata_do">;
  }

  Object.assign(updates, inferDictionarySentenceUpdates(text), inferTableProfileUpdates(text));

  if (updates.normalizedTopic && (!updates.independentVariable || !updates.dependentVariable)) {
    const normalized = normalizeTopic(updates.normalizedTopic);
    updates.independentVariable ||= normalized.independentVariable;
    updates.dependentVariable ||= normalized.dependentVariable;
  }

  return Object.fromEntries(
    Object.entries(updates).filter(([key, value]) => {
      if (key === "instrumentVariable" && value === null) {
        // “不做 IV / 工具变量”是明确指令，保留 null 让后续流程清空历史工具变量。
        return true;
      }
      if (value == null) {
        return false;
      }
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return true;
    })
  ) as WorkflowInputInterpreterProfilePatch;
}

function looksLikeTopicCandidateText(text: string) {
  return /(?:\u7814\u7a76\u4e3b\u9898|\u9898\u76ee|\u4e3b\u9898|\u89e3\u91ca\u53d8\u91cf|\u88ab\u89e3\u91ca\u53d8\u91cf|\u63a7\u5236\u53d8\u91cf|\u6837\u672c\u533a\u95f4|\u56fa\u5b9a\u6548\u5e94)[:\uFF1A]/i.test(text)
    || /\u5bf9.+(?:\u5f71\u54cd|\u4f5c\u7528)|\u5173\u7cfb\u7814\u7a76|\u5f71\u54cd\u7814\u7a76|\u6548\u5e94\u7814\u7a76/.test(text)
    || (text.trim().length >= 8 && /(\u5f71\u54cd|\u5173\u7cfb|\u6548\u5e94|\u53d8\u91cf|\u6837\u672c|\u56fa\u5b9a\u6548\u5e94|\u56de\u5f52)/.test(text));
}

function looksLikeWorkflowAdvance(text: string) {
  const trimmed = text.trim();
  return /^(\u7ee7\u7eed|\u7ee7\u7eed\u5427|\u4e0b\u4e00\u6b65|\u8fdb\u5165\u4e0b\u4e00\u6b65|\u5f80\u4e0b|\u5f00\u59cb\u751f\u6210|\u751f\u6210\u5427|\u76f4\u63a5\u751f\u6210|\u7ee7\u7eed\u751f\u6210|go on|continue|next|proceed)$/i.test(trimmed)
    || interpreterConfirmWords.has(normalizeIntentText(trimmed));
}

function looksLikeTopicReset(text: string) {
  return /(\u6362\u4e00\u4e2a|\u6362\u4e2a|\u91cd\u65b0\u6765|\u91cd\u6765|\u91cd\u5199|\u91cd\u505a|\u53e6\u4e00\u4e2a|\u91cd\u65b0\u9009\u9898|\u91cd\u65b0\u6362\u9898)/i.test(text)
    && !looksLikeTopicCandidateText(text);
}

function looksLikeAmbiguousFeedback(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return false;
  }

  return /^(\u597d|\u597d\u7684|\u884c|\u53ef\u4ee5|\u6536\u5230|\u660e\u767d|\u77e5\u9053\u4e86|\u5148\u8fd9\u6837|\u5dee\u4e0d\u591a|\u90fd\u884c|\u6ca1\u95ee\u9898|\u6709\u70b9\u95ee\u9898|\u4e0d\u592a\u5bf9|\u4e0d\u592a\u884c|\u6539\u4e00\u4e0b|\u518d\u60f3\u60f3|\u968f\u4fbf|ok|okay|sure|fine)$/i.test(trimmed);
}

function buildClarificationForStep(step: WorkflowStep) {
  if (step === WorkflowStep.TOPIC_DETECT || step === WorkflowStep.TOPIC_NORMALIZE) {
    return {
      clarificationQuestion:
        "\u4f60\u53ef\u4ee5\u5148\u7528\u4e00\u53e5\u81ea\u7136\u8bed\u8a00\u8bf4\u4f60\u60f3\u7814\u7a76\u4ec0\u4e48\uff0c\u6216\u8005\u76f4\u63a5\u8bf4\u4f60\u60f3\u6362\u6210\u4ec0\u4e48\u65b9\u5411\u3002\u6211\u4f1a\u5148\u5e2e\u4f60\u6574\u7406\u6210\u8bba\u6587\u9898\u76ee\uff0c\u518d\u8bf7\u4f60\u786e\u8ba4\u3002",
      guidanceTitle: "\u4f60\u53ef\u4ee5\u8fd9\u6837\u8bf4",
      guidanceOptions: [
        "\u6211\u60f3\u7814\u7a76\u91d1\u878d\u76d1\u7ba1\u5bf9\u4f01\u4e1aESG\u7684\u5f71\u54cd",
        "\u628a\u7814\u7a76\u5bf9\u8c61\u6539\u6210\u4e2d\u56fdA\u80a1\u4e0a\u5e02\u516c\u53f8",
        "\u8fd9\u4e2a\u65b9\u5411\u592a\u6cdb\u4e86\uff0c\u6211\u60f3\u6539\u6210\u6570\u5b57\u91d1\u878d\u5bf9\u4f01\u4e1a\u521b\u65b0\u7684\u5f71\u54cd"
      ]
    };
  }

  if (step === WorkflowStep.SOP_GUIDE || step === WorkflowStep.DATA_CLEANING || step === WorkflowStep.DATA_CHECK) {
    return {
      clarificationQuestion:
        "\u6211\u5148\u786e\u8ba4\u4e00\u4e0b\u4f60\u7684\u610f\u601d\u3002\u4f60\u662f\u60f3\u4fee\u6539\u53d8\u91cf\u8bbe\u5b9a\uff0c\u8865\u5145\u6570\u636e\u53e3\u5f84\uff0c\u8fd8\u662f\u76f4\u63a5\u7ee7\u7eed\u4e0b\u4e00\u6b65\uff1f\u5982\u679c\u65b9\u4fbf\uff0c\u76f4\u63a5\u8bf4\u4f60\u8981\u6539\u54ea\u4e00\u9879\u3002",
      guidanceTitle: "\u4f60\u53ef\u4ee5\u8fd9\u6837\u8bf4",
      guidanceOptions: [
        "\u7814\u7a76\u5bf9\u8c61\u6539\u6210\u4e2d\u56fdA\u80a1\u4e0a\u5e02\u516c\u53f8",
        "\u63a7\u5236\u53d8\u91cf\u589e\u52a0\u4f01\u4e1a\u89c4\u6a21\u548c\u8d44\u4ea7\u8d1f\u503a\u7387",
        "\u5982\u679c\u6ca1\u95ee\u9898\uff0c\u5c31\u7ee7\u7eed\u5230\u4e0b\u4e00\u6b65"
      ]
    };
  }

  return {
    clarificationQuestion:
      "\u6211\u5148\u786e\u8ba4\u4e00\u4e0b\u4f60\u60f3\u8c03\u6574\u7684\u662f\u54ea\u4e00\u90e8\u5206\u3002\u4f60\u53ef\u4ee5\u76f4\u63a5\u8bf4\u8981\u4fee\u6539\u53d8\u91cf\u3001\u6a21\u578b\u8bbe\u5b9a\uff0c\u6216\u8005\u8ba9\u6211\u5148\u89e3\u91ca\u4e00\u4e0b\u8fd9\u4e2a\u6982\u5ff5\u3002",
    guidanceTitle: "\u4f60\u53ef\u4ee5\u8fd9\u6837\u8bf4",
    guidanceOptions: [
      "\u8bf7\u5148\u89e3\u91ca\u4e00\u4e0b\u53cc\u5411\u56fa\u5b9a\u6548\u5e94",
      "\u6211\u60f3\u628a\u63a7\u5236\u53d8\u91cf\u518d\u8865\u5145\u5b8c\u6574\u4e00\u70b9",
      "\u5982\u679c\u8fd9\u4e00\u6b65\u6ca1\u95ee\u9898\uff0c\u5c31\u7ee7\u7eed"
    ]
  };
}

const researchSetupRequiredFields: Array<keyof ResearchSetupInterpreterProfilePatch> = [
  "normalizedTopic",
  "researchObject",
  "independentVariable",
  "dependentVariable",
  "controls",
  "sampleScope",
  "fixedEffects"
];

function cleanResearchSetupPatch(updates: ResearchSetupInterpreterProfilePatch): ResearchSetupInterpreterProfilePatch {
  return Object.fromEntries(
    Object.entries(updates).filter(([key, value]) => {
      if (key === "instrumentVariable" && value === null) {
        // 明确“不做工具变量”需要保留清空信号；其他空值仍不能覆盖已有 researchProfile。
        return true;
      }
      if (value == null) {
        return false;
      }
      if (typeof value === "string") {
        const normalized = value.trim();
        return normalized.length > 0 && !/^(待补充|默认不做|不做|不需要|无需)$/i.test(normalized);
      }
      if (Array.isArray(value)) {
        return value.some((item) => {
          const normalized = String(item).trim();
          return normalized && !/^(待补充|默认不做|不做|不需要|无需)$/i.test(normalized);
        });
      }
      return true;
    })
  ) as ResearchSetupInterpreterProfilePatch;
}

function inferResearchSetupFallbackUpdates(message: string): ResearchSetupInterpreterProfilePatch {
  const updates = inferProfileUpdates(message) as ResearchSetupInterpreterProfilePatch;
  const text = message.trim();

  updates.normalizedTopic ||= inferShortTopicTitle(text, updates);

  if (looksLikeTopicCandidateText(text) && (!updates.normalizedTopic || !updates.independentVariable || !updates.dependentVariable)) {
    const topicSeed = text.split(/[。.!?\n]/)[0] || text;
    const normalized = normalizeTopic(topicSeed);
    updates.normalizedTopic ||= normalized.normalizedTopic;
    updates.independentVariable ||= normalized.independentVariable;
    updates.dependentVariable ||= normalized.dependentVariable;
  }

  if (!updates.researchObject && /A\s*股|上市公司|企业/i.test(text)) {
    updates.researchObject = DEFAULT_RESEARCH_OBJECT;
  }

  if (!updates.sampleScope) {
    const sampleScope = inferYearRange(text);
    if (sampleScope) {
      updates.sampleScope = sampleScope;
    }
  }

  if (!updates.fixedEffects && /(固定|FE|fixed).{0,12}(企业|公司|年份|年|时间)|(?:企业|公司).{0,4}(?:和|与|、).{0,4}(?:年份|年).{0,4}固定/i.test(text)) {
    updates.fixedEffects = normalizeFixedEffects(text);
  }

  const controls =
    text.match(/控制(?:变量)?(?:包括|有|就|是|为)?\s*([^。；;]+?)(?:固定|样本|研究对象|$)/)?.[1]?.trim() ?? "";
  if (!updates.controls && controls) {
    updates.controls = splitItems(controls.replace(/这些$/, ""));
  }

  return cleanResearchSetupPatch(updates);
}

function buildResearchSetupMissingFields(
  updates: ResearchSetupInterpreterProfilePatch,
  hasExistingTopic: boolean
) {
  return researchSetupRequiredFields.filter((field) => {
    if (field === "normalizedTopic" && hasExistingTopic) {
      return false;
    }

    const value = updates[field];
    if (Array.isArray(value)) {
      return value.length === 0;
    }
    return !String(value ?? "").trim();
  }) as string[];
}

function buildFallbackSetupAssistantMessage(updates: ResearchSetupInterpreterProfilePatch, missingFields: string[]) {
  const recognized: string[] = [];
  if (updates.normalizedTopic || updates.independentVariable || updates.dependentVariable) {
    recognized.push("研究主题和核心变量");
  }
  if (updates.researchObject) {
    recognized.push("研究对象");
  }
  if (updates.controls?.length) {
    recognized.push("控制变量");
  }
  if (updates.sampleScope) {
    recognized.push("样本区间");
  }
  if (updates.fixedEffects?.length) {
    recognized.push("固定效应");
  }

  if (missingFields.length === 0) {
    return recognized.length > 0
      ? `我已经整理好${recognized.join("、")}。请确认是否基于这套设定生成完整 Stata 工作流。`
      : "我已经收到您的研究设定。请继续补充研究对象、变量、样本区间和固定效应，或确认是否进入下一步。";
  }

  return `我已经识别到${recognized.length ? recognized.join("、") : "部分研究设定"}，还需要您补充 ${missingFields.join("、")}。`;
}

export function buildResearchSetupInterpreterOutput(
  input: ResearchSetupInterpreterInput
): ResearchSetupInterpreterOutput {
  const message = input.userMessage.trim();

  if (wantsSetupExampleInput(message) || looksLikeSmallTalkOrOffTopic(message)) {
    return {
      intent: "research_question",
      profileUpdates: {},
      missingFields: [],
      // 示例只作为引导回答，profileUpdates 必须保持为空，避免示例污染 researchProfile。
      assistantMessage: DEFAULT_SETUP_EXAMPLE_MESSAGE,
      confidence: "high"
    };
  }

  if (looksLikeWorkflowQuestion(message)) {
    const chat = buildGeneralResearchChatOutput({
      userQuestion: message,
      currentModule: input.currentModule || input.currentStep,
      topic: input.topic
    });

    return {
      intent: "research_question",
      profileUpdates: {},
      missingFields: [],
      assistantMessage: chat.answer,
      confidence: "high"
    };
  }

  const profileUpdates = inferResearchSetupFallbackUpdates(message);
  const missingFields = buildResearchSetupMissingFields(profileUpdates, Boolean(input.topic));

  return {
    intent: "research_setup",
    profileUpdates,
    missingFields,
    assistantMessage: buildFallbackSetupAssistantMessage(profileUpdates, missingFields),
    confidence: Object.keys(profileUpdates).length > 0 ? "medium" : "low"
  };
}

export function buildWorkflowInputInterpreterOutput(
  input: WorkflowInputInterpreterInput
): WorkflowInputInterpreterOutput {
  const message = input.userMessage.trim();
  const normalized = normalizeIntentText(message);
  const profileUpdates = inferProfileUpdates(message);
  const hasProfileUpdates = Object.keys(profileUpdates).length > 0;

  if (input.currentStep === WorkflowStep.TOPIC_NORMALIZE && interpreterConfirmWords.has(normalized)) {
    return {
      route: "continue_workflow",
      interpretedIntent: "confirm_topic",
      normalizedUserMessage: "\u786e\u8ba4\u4e3b\u9898",
      clarificationQuestion: "",
      guidanceTitle: "",
      guidanceOptions: [],
      reason: "\u7528\u6237\u5df2\u660e\u786e\u786e\u8ba4\u4e3b\u9898",
      confidence: "high",
      profileUpdates: {}
    };
  }

  if (looksLikeWorkflowAdvance(message)) {
    return {
      route: "continue_workflow",
      interpretedIntent: "advance_workflow",
      normalizedUserMessage:
        input.currentStep === WorkflowStep.TOPIC_NORMALIZE
          ? "\u786e\u8ba4\u4e3b\u9898"
          : "\u7ee7\u7eed\u8fdb\u5165\u4e0b\u4e00\u6b65",
      clarificationQuestion: "",
      guidanceTitle: "",
      guidanceOptions: [],
      reason: "\u7528\u6237\u5e0c\u671b\u63a8\u8fdb\u5f53\u524dworkflow",
      confidence: "high",
      profileUpdates
    };
  }

  if (looksLikeWorkflowQuestion(message)) {
    return {
      route: "general_research_chat",
      interpretedIntent: "general_research_question",
      normalizedUserMessage: message,
      clarificationQuestion: "",
      guidanceTitle: "",
      guidanceOptions: [],
      reason: "\u7528\u6237\u5728\u63d0\u51fa\u7814\u7a76\u65b9\u6cd5\u6216\u6982\u5ff5\u95ee\u9898",
      confidence: "high",
      profileUpdates: {}
    };
  }

  if (looksLikeSmallTalkOrOffTopic(message)) {
    return {
      route: "general_research_chat",
      interpretedIntent: "small_talk_or_off_topic",
      normalizedUserMessage: message,
      clarificationQuestion: "",
      guidanceTitle: "",
      guidanceOptions: [],
      reason: "\u7528\u6237\u6b63\u5728\u5bd2\u6684\u3001\u8f93\u5165\u6807\u70b9\u6216\u63d0\u51fa\u975e\u79d1\u7814\u95ee\u9898",
      confidence: "high",
      profileUpdates: {}
    };
  }

  if (hasProfileUpdates) {
    return {
      route: "continue_workflow",
      interpretedIntent: "update_research_profile",
      normalizedUserMessage: message,
      clarificationQuestion: "",
      guidanceTitle: "",
      guidanceOptions: [],
      reason: "\u7528\u6237\u5728\u8865\u5145\u6216\u4fee\u6539\u7814\u7a76\u8bbe\u5b9a",
      confidence: "high",
      profileUpdates
    };
  }

  if (input.currentStep === WorkflowStep.TOPIC_NORMALIZE && looksLikeTopicReset(message)) {
    const clarification = buildClarificationForStep(input.currentStep);
    return {
      route: "ask_clarification",
      interpretedIntent: "replace_topic_direction",
      normalizedUserMessage: "",
      clarificationQuestion: clarification.clarificationQuestion,
      guidanceTitle: clarification.guidanceTitle,
      guidanceOptions: clarification.guidanceOptions,
      reason: "\u7528\u6237\u60f3\u6362\u9898\uff0c\u4f46\u8fd8\u6ca1\u7ed9\u51fa\u65b0\u7684\u65b9\u5411",
      confidence: "medium",
      profileUpdates: {}
    };
  }

  if (looksLikeAmbiguousFeedback(message) || (interpreterConfirmWords.has(normalized) && input.currentStep !== WorkflowStep.TOPIC_NORMALIZE)) {
    const clarification = buildClarificationForStep(input.currentStep);
    return {
      route: "ask_clarification",
      interpretedIntent: "ambiguous_feedback",
      normalizedUserMessage: "",
      clarificationQuestion: clarification.clarificationQuestion,
      guidanceTitle: clarification.guidanceTitle,
      guidanceOptions: clarification.guidanceOptions,
      reason: "\u7528\u6237\u53cd\u9988\u8f83\u6a21\u7cca\uff0c\u8fd8\u4e0d\u8db3\u4ee5\u76f4\u63a5\u63a8\u8fdbworkflow",
      confidence: "medium",
      profileUpdates: {}
    };
  }

  return {
    route: "continue_workflow",
    interpretedIntent: "direct_workflow_input",
    normalizedUserMessage: message,
    clarificationQuestion: "",
    guidanceTitle: "",
    guidanceOptions: [],
    reason: "\u6309\u5f53\u524dworkflow\u8f93\u5165\u7ee7\u7eed\u5904\u7406",
    confidence: "medium",
    profileUpdates: {}
  };
}

export function detectTopic(raw: string): TopicDetectOutput {
  const input = raw.trim();
  const guidanceOptions = [
    "\u91d1\u878d\u76d1\u7ba1\u5bf9\u4f01\u4e1aESG\u8868\u73b0\u7684\u5f71\u54cd",
    "\u6570\u5b57\u91d1\u878d\u5bf9\u4f01\u4e1a\u521b\u65b0\u7684\u5f71\u54cd",
    "\u9ad8\u7ba1\u7279\u5f81\u4e0e\u516c\u53f8\u6cbb\u7406\u5173\u7cfb\u7814\u7a76"
  ];

  if (!input) {
    return {
      isValidTopic: false,
      topicType: "not_topic",
      needsGuidance: true,
      reason: "\u60a8\u8fd8\u6ca1\u6709\u8f93\u5165\u5177\u4f53\u7684\u7814\u7a76\u4e3b\u9898\u3002\u53ef\u4ee5\u5148\u544a\u8bc9\u6211\u60f3\u7814\u7a76\u4ec0\u4e48\u73b0\u8c61\u3001\u53d8\u91cf\u6216\u6837\u672c\uff0c\u6211\u6765\u5e2e\u60a8\u6574\u7406\u6210\u9898\u76ee\u3002",
      guidanceOptions
    };
  }

  if (/^(hi|hello|hey|\u4f60\u597d|\u60a8\u597d|\u5728\u5417|\u54c8\u55bd|\u55e8)\b/i.test(input) || /\u641e\u9e21\u6bdb|\u641e\u4ec0\u4e48/.test(input) || input.length <= 2) {
    return {
      isValidTopic: false,
      topicType: "not_topic",
      needsGuidance: true,
      reason: `\u60a8\u8f93\u5165\u7684\u201c${input}\u201d\u5c5e\u4e8e\u95f2\u804a\u6216\u65e0\u5b9e\u8d28\u5185\u5bb9\uff0c\u4e0d\u6784\u6210\u7814\u7a76\u4e3b\u9898\uff0c\u65e0\u6cd5\u8fdb\u5165\u7ecf\u7ba1\u5b9e\u8bc1\u8bba\u6587\u6d41\u7a0b\u3002`,
      guidanceOptions
    };
  }

  if (/stata|regression|help|paper|thesis|\u4ee3\u7801|\u62a5\u9519|\u8f6f\u4ef6/i.test(input)) {
    return {
      isValidTopic: false,
      topicType: "not_topic",
      needsGuidance: true,
      reason: `\u60a8\u8f93\u5165\u7684\u201c${input}\u201d\u66f4\u50cf\u662f\u6c42\u52a9\u6216\u8f6f\u4ef6\u76f8\u5173\u5185\u5bb9\uff0c\u8fd8\u4e0d\u662f\u4e00\u4e2a\u53ef\u4ee5\u76f4\u63a5\u8fdb\u5165\u7814\u7a76\u6d41\u7a0b\u7684\u9898\u76ee\u3002`,
      guidanceOptions
    };
  }

  if (input.length <= 4) {
    return {
      isValidTopic: true,
      topicType: "partial_topic",
      needsGuidance: true,
      reason: `\u60a8\u8f93\u5165\u7684\u201c${input}\u201d\u66f4\u50cf\u662f\u7814\u7a76\u65b9\u5411\u6216\u5173\u952e\u8bcd\uff0c\u8fd8\u7f3a\u5c11\u660e\u786e\u7684\u53d8\u91cf\u5173\u7cfb\u6216\u7814\u7a76\u5bf9\u8c61\u3002`,
      guidanceOptions
    };
  }

  const topicPattern = new RegExp(`(${CHINESE_TO}|${CHINESE_AND}|${CHINESE_AND_ALT}|${CHINESE_INFLUENCE}|impact|effect|relation)`, "i");
  if (topicPattern.test(input)) {
    return {
      isValidTopic: true,
      topicType: new RegExp(`${CHINESE_TO}.+${CHINESE_INFLUENCE}|impact|effect`, "i").test(input)
        ? "full_topic"
        : "partial_topic",
      needsGuidance: false,
      reason: "\u8fd9\u4e2a\u8f93\u5165\u5df2\u7ecf\u5305\u542b\u8f83\u660e\u786e\u7684\u7814\u7a76\u5173\u7cfb\uff0c\u53ef\u4ee5\u7ee7\u7eed\u6574\u7406\u6210\u6807\u51c6\u5316\u9898\u76ee\u3002",
      guidanceOptions
    };
  }

  return {
    isValidTopic: true,
    topicType: "partial_topic",
    needsGuidance: true,
    reason: `\u60a8\u8f93\u5165\u7684\u201c${input}\u201d\u5df2\u7ecf\u63a5\u8fd1\u7814\u7a76\u4e3b\u9898\uff0c\u4f46\u5efa\u8bae\u518d\u8865\u5145\u89e3\u91ca\u53d8\u91cf\u3001\u88ab\u89e3\u91ca\u53d8\u91cf\u6216\u7814\u7a76\u5bf9\u8c61\u3002`,
    guidanceOptions
  };
}
function normalizeTopicFragment(value: string, role: "x" | "y") {
  let cleaned = cleanTerm(value)
    .replace(/\s+/g, " ")
    .replace(/^(?:我想|想)?研究/u, "")
    .replace(/^[“”"'`\s]+|[“”"'`\s]+$/gu, "")
    .trim();

  if (role === "y") {
    cleaned = cleaned
      .replace(/(?:的)?影响研究$/u, "")
      .replace(/(?:的)?效应研究$/u, "")
      .replace(/(?:的)?关系研究$/u, "")
      .replace(/(?:的)?影响$/u, "")
      .replace(/(?:的)?效应$/u, "")
      .replace(/(?:的)?关系$/u, "")
      .replace(/研究$/u, "")
      .trim();
  }

  return cleaned || value.trim();
}

export function normalizeTopic(raw: string): TopicNormalizeOutput {
  const input = raw.trim();
  const chineseStructuredPattern = input.match(/^(.+?)(?:对|与|和)(.+?)(?:的)?(?:影响|效应|关系)(?:研究)?$/u);
  const againstPattern = input.match(
    new RegExp(`(.+?)(?:${CHINESE_TO}|${CHINESE_AND}|${CHINESE_AND_ALT}|to)(.+?)(?:${CHINESE_INFLUENCE}|impact|effect)?$`, "i")
  );
  const relationPattern = input.match(/(.+?)\s+(?:affects?|impacts?)\s+(.+)/i);

  let x = "核心解释变量";
  let y = "核心结果变量";

  if (chineseStructuredPattern) {
    x = normalizeTopicFragment(chineseStructuredPattern[1], "x");
    y = normalizeTopicFragment(chineseStructuredPattern[2], "y");
  } else if (againstPattern) {
    x = normalizeTopicFragment(againstPattern[1], "x");
    y = normalizeTopicFragment(againstPattern[2], "y");
  } else if (relationPattern) {
    x = normalizeTopicFragment(relationPattern[1], "x");
    y = normalizeTopicFragment(relationPattern[2], "y");
  } else {
    x = normalizeTopicFragment(input, "x");
    y = "企业结果变量";
  }

  const normalizedTopic = `${x} 对 ${y} 的影响研究`;

  return {
    normalizedTopic,
    independentVariable: x,
    dependentVariable: y,
    researchObject: DEFAULT_RESEARCH_OBJECT,
    relationship: "\u6b63\u5411\u3001\u8d1f\u5411\u548c\u4e0d\u663e\u8457",
    confirmationMessage: "请问是否确认主题？",
    candidateTopics: [
      normalizedTopic,
      `${x} 与 ${y}` ,
      `${x} 是否会影响 ${y}？`
    ]
  };
}

export function buildDataCleaningOutput(input: {
  dependentVariable: string;
  independentVariable: string;
  controls: string[];
  needLogVars: string[];
}) {
  const vars = [input.dependentVariable, input.independentVariable, ...input.controls].filter(Boolean);
  const uniqueVars = Array.from(new Set(vars));
  const logStatements = input.needLogVars.length
    ? input.needLogVars.map((item) => `gen ln_${item} = ln(${item})`).join("\n")
    : "* 如需对规模类变量取对数，请在这里补充 ln 处理";

  return {
    moduleName: "data_cleaning",
    purpose: "安装后续工作流需要的 Stata 扩展命令，并在回归之前完成变量类型、缺失值和极端值的基础清洗。",
    meaning: `围绕当前题目，先把 ${input.dependentVariable}、${input.independentVariable} 以及控制变量整理成可直接进入 Stata 回归的形式。`,
    variableDesign: [
      "集中安装工作流需要的扩展命令，后续模块不再重复安装。",
      ...uniqueVars.map((item) => `检查 ${item} 是否为数值型、是否存在异常值和缺失值`)
    ],
    modelSpec: "本阶段不估计正式模型，重点是把数据整理干净。",
    stataCode: [
      ...DATA_CLEANING_INSTALL_LINES,
      "",
      `destring ${uniqueVars.join(" ")}, replace force`,
      `drop if missing(${[input.dependentVariable, input.independentVariable, ...input.controls.slice(0, 2)].filter(Boolean).join(", ")})`,
      logStatements,
      `winsor2 ${uniqueVars.join(" ")}, replace cuts(1 99)`
    ].join("\n"),
    codeExplanation: [
      "开头的安装区集中准备后续模块需要的扩展命令。",
      "destring 用于把字符串型变量转换成数值型变量。",
      "drop if missing 用于删除核心变量缺失的样本。",
      "对数处理一般用于规模类变量或右偏分布较明显的变量。",
      "winsor2 用于对 1% 和 99% 分位数进行缩尾，降低极端值影响。"
    ],
    interpretationGuide: [
      "清洗完成后建议先运行 summarize，确认变量分布是否合理。"
    ],
    nextSuggestion: "完成清洗后，建议继续做数据结构与描述统计检查。"
  };
}

export function buildDataCheckOutput(input: {
  panelId?: string | null;
  timeVar?: string | null;
  keyVariables: string[];
}) {
  const summarizeVars = input.keyVariables.length ? input.keyVariables.join(" ") : "y x control1 control2";
  const lines = ["describe", `summarize ${summarizeVars}`];
  if (input.timeVar) {
    lines.push(`tab ${input.timeVar}`);
  }
  if (input.panelId && input.timeVar) {
    lines.push(`xtset ${input.panelId} ${input.timeVar}`);
  }

  return {
    moduleName: "data_check",
    purpose: "检查变量类型、描述统计、时间分布以及面板结构是否合理。",
    meaning: "这一步可以在进入基准回归前尽量发现变量异常、年份缺失和面板设定错误。",
    variableDesign: input.keyVariables.map((item) => `查看 ${item} 的描述统计和数据分布`),
    modelSpec: "本阶段不估计正式模型，重点是做数据结构验证。",
    stataCode: lines.join("\n"),
    codeExplanation: [
      "describe 用于快速查看变量类型、标签和存储格式。",
      "summarize 用于检查关键变量的均值、标准差和极值。",
      input.timeVar ? `tab ${input.timeVar} 用于查看年份或时间维度是否连续。` : "当前没有提供时间变量，因此跳过时间分布检查。",
      input.panelId && input.timeVar
        ? "xtset 用于验证面板结构是否可用。"
        : "由于面板维度不完整，当前暂不执行 xtset。"
    ],
    checkItems: ["变量类型是否正确", "样本量是否合理", "年份覆盖是否完整", "面板结构是否有效"],
    nextSuggestion: "如果数据检查结果正常，就可以进入基准回归。"
  };
}

export function buildRegressionOutput(
  moduleName: string,
  input: RegressionSkillInput,
  moduleLabel: string
): RegressionSkillOutput {
  const controls = input.controls?.join(" ") || "";
  const absorb = input.fixedEffects?.length ? `, absorb(${input.fixedEffects.join(" ")})` : "";
  const cluster = input.clusterVar ? ` vce(cluster ${input.clusterVar})` : "";
  const stataCode = `reghdfe ${input.dependentVariable} ${input.independentVariable}${controls ? ` ${controls}` : ""}${absorb}${cluster}`;
  const feAddText = input.fixedEffects?.length
    ? input.fixedEffects.map((item) => `${item} FE, YES`).join(", ")
    : "FE, NOT SPECIFIED";
  const exportState = input.exportState ?? {
    fileName: `${moduleName}.doc`,
    filePath: `${STATA_RESULTS_DIRECTORY}/${moduleName}.doc`,
    writeMode: ExportWriteMode.REPLACE
  };

  return {
    moduleName,
    purpose: `${moduleLabel}用于检验核心研究假设是否成立。`,
    meaning: `在当前题目下，重点关注 ${input.independentVariable} 对 ${input.dependentVariable} 的方向和显著性。`,
    variableDesign: [
      `被解释变量：${input.dependentVariable}`,
      `核心解释变量：${input.independentVariable}`,
      `控制变量：${input.controls?.length ? input.controls.join("、") : "暂未提供"}`,
      `固定效应：${input.fixedEffects?.length ? input.fixedEffects.join("、") : "暂未提供"}`
    ],
    modelSpec: `${input.dependentVariable} = beta0 + beta1 * ${input.independentVariable} + controls + fixed effects + error`,
    stataCode,
    codeExplanation: [
      "默认使用 reghdfe 作为固定效应回归估计命令。",
      input.fixedEffects?.length ? "absorb(...) 用于加入你指定的固定效应。" : "当前未提供固定效应，因此代码保持为较简化的基准形式。",
      input.clusterVar ? `vce(cluster ${input.clusterVar}) 用于加入聚类稳健标准误。` : "当前未提供聚类变量，因此暂不加入 cluster 设定。"
    ],
    interpretationGuide: [
      "先看 R-squared 或 Adjusted R-squared。",
      "再看核心解释变量的符号与显著性。",
      "同时记录样本量、固定效应与标准误设定。"
    ],
    termMappings: input.termMappings ?? [],
    instrumentSelectionCriteria: [],
    mechanismPaths: [],
    export: {
      fileName: exportState.fileName,
      filePath: exportState.filePath,
      writeMode: exportState.writeMode,
      exportCode: `outreg2 using \"${exportState.filePath}\", ${exportState.writeMode} tdec(2) bdec(3) adjr2 tstat addtext(${feAddText})`
    },
    nextSuggestion: moduleName === SkillName.BASELINE_REGRESSION ? "如果基准回归结果稳定，下一步可以进入稳健性检验。" : "导出结果后，可以继续推进下一个扩展模块。"
  };
}

export function interpretRegressionResult(input: ResultInterpretInput): ResultInterpretOutput {
  const text = input.resultText;
  const missingInfo: string[] = [];
  if (!/R.?2|Adj/i.test(text)) {
    missingInfo.push("R-squared / Adjusted R-squared");
  }
  if (!/N\s*=|Observations|Number of obs/i.test(text)) {
    missingInfo.push("样本量");
  }

  const significant = /\*\*\*|\*\*|\*|p<|significant/i.test(text);
  const isPositive = /(^|\s)0?\.\d+\*|positive|coef\..*\+|\bplus\b/i.test(text);

  return {
    plainExplanation: significant
      ? `从当前结果看，核心解释变量的系数为${isPositive ? "正" : "明确方向"}且统计上显著，初步支持研究假设。`
      : "从当前输出看，核心解释变量尚未呈现清晰的统计显著性，暂时不能认为研究假设得到支持。",
    paperStyleExplanation: significant
      ? "回归结果表明，核心解释变量与被解释变量之间存在统计显著的关联，为研究假设提供了初步经验支持。"
      : "当前回归结果尚未识别出稳定且显著的核心效应，因此在进一步检验之前，不宜作出强结论。",
    analysisPoints: ["R-squared / Adjusted R-squared", "核心系数显著性", "系数符号", "样本量", "固定效应设定"],
    missingInfo,
    nextSuggestion: significant ? "可以继续做稳健性检验，或导出当前回归表。" : "建议先回看变量设定、样本区间和固定效应选择，再继续下一步。"
  };
}

export function classifyStataError(input: StataErrorDebugInput): StataErrorDebugOutput {
  const errorText = input.errorText.toLowerCase();
  if (errorText.includes("command") && errorText.includes("not found")) {
    const command = input.errorText.match(/command\s+([^\s]+)/i)?.[1] ?? "该命令";
    return {
      errorType: "command_not_found",
      explanation: `${command} 尚未安装到当前 Stata 环境中。`,
      fixCode: "* 请回到数据清洗模块，运行 Stata 代码最顶部的扩展命令安装区。",
      retryMessage: "完成数据清洗模块顶部的集中安装后，再重新运行原始代码；如果仍有报错，再把完整报错贴回来。"
    };
  }

  if (errorText.includes("variable") || errorText.includes("not found")) {
    return {
      errorType: "variable_not_found",
      explanation: "这个报错更像是变量名不存在、拼写错误，或者当前数据集中没有加载该变量。",
      fixCode: "describe\nlookfor variable_name",
      retryMessage: "请先确认变量真实名称，再重新运行代码。"
    };
  }

  if (errorText.includes("invalid syntax") || errorText.includes("syntax")) {
    return {
      errorType: "syntax_error",
      explanation: "这通常是 Stata 语法问题，例如逗号、括号、换行或 absorb() 写法不正确。",
      fixCode: input.relatedCode || "逐行检查逗号、括号、if 条件和 absorb() 语法。",
      retryMessage: "修正语法后重新运行。如果仍失败，请把完整命令和完整报错一起发来。"
    };
  }

  if (errorText.includes("path") || errorText.includes("file") || errorText.includes("invalid name")) {
    return {
      errorType: "path_error",
      explanation: "这类报错通常与导出路径、文件名或目录不存在有关。",
      fixCode: "请把导出路径改成一个已存在且尽量使用 ASCII 的目录，例如：D:\\results\\baseline.doc",
      retryMessage: "修改路径后重新运行导出命令。"
    };
  }

  return {
    errorType: "unknown_error",
    explanation: "仅凭当前文本还无法稳定识别错误类型。",
    fixCode: input.relatedCode || "请把完整报错文本和对应 Stata 命令一起发来。",
    retryMessage: "补充完整上下文后，就可以进一步缩小排查范围。"
  };
}

export function buildPlaceholderSkillOutput(skillName: SkillName): PlaceholderSkillOutput {
  return {
    moduleName: skillName,
    status: "coming_soon",
    message: `${skillName} 模块已完成接口、目录和 schema 预留，下一阶段会补上真实推理与代码生成能力。`
  };
}
