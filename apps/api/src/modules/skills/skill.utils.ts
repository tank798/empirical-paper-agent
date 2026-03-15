import {
  ExportWriteMode,
  SkillName,
  type PlaceholderSkillOutput,
  type RegressionSkillInput,
  type RegressionSkillOutput,
  type ResultInterpretInput,
  type ResultInterpretOutput,
  type StataErrorDebugInput,
  type StataErrorDebugOutput,
  type TopicDetectOutput,
  type TopicNormalizeOutput
} from "@empirical/shared";

function cleanTerm(value: string) {
  return value.replace(/[。；;,.，]/g, "").trim();
}

const CHINESE_INFLUENCE = "\\u5f71\\u54cd";
const CHINESE_TO = "\\u5bf9";
const CHINESE_AND = "\\u4e0e";
const CHINESE_AND_ALT = "\\u8207";

export function detectTopic(raw: string): TopicDetectOutput {
  const input = raw.trim();
  const guidanceOptions = [
    "金融监管与企业 ESG 表现",
    "数字金融与企业创新",
    "ESG 表现与融资成本"
  ];

  if (!input) {
    return {
      isValidTopic: false,
      topicType: "not_topic",
      needsGuidance: true,
      reason: "输入为空，请先给出一个研究主题。",
      guidanceOptions
    };
  }

  if (/stata|regression|help|paper|thesis/i.test(input)) {
    return {
      isValidTopic: false,
      topicType: "not_topic",
      needsGuidance: true,
      reason: "当前输入更像求助请求，而不是一个可直接进入实证流程的研究主题。",
      guidanceOptions
    };
  }

  if (input.length <= 4) {
    return {
      isValidTopic: true,
      topicType: "partial_topic",
      needsGuidance: true,
      reason: "当前输入更像研究领域或关键词，还缺少明确的变量关系与研究对象。",
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
      reason: "当前输入已经包含较明确的变量关系，可以继续进入主题标准化步骤。",
      guidanceOptions
    };
  }

  return {
    isValidTopic: true,
    topicType: "partial_topic",
    needsGuidance: true,
    reason: "当前输入已经接近研究主题，但仍建议补充解释变量、被解释变量或作用方向。",
    guidanceOptions
  };
}

export function normalizeTopic(raw: string): TopicNormalizeOutput {
  const input = raw.trim();
  const againstPattern = input.match(new RegExp(`(.+?)(?:${CHINESE_TO}|${CHINESE_AND}|${CHINESE_AND_ALT}|to)(.+?)(?:${CHINESE_INFLUENCE}|impact|effect)?$`, "i"));
  const relationPattern = input.match(/(.+?)\s+(?:affects?|impacts?)\s+(.+)/i);

  let x = "核心解释变量";
  let y = "核心结果变量";

  if (againstPattern) {
    x = cleanTerm(againstPattern[1]);
    y = cleanTerm(againstPattern[2]);
  } else if (relationPattern) {
    x = cleanTerm(relationPattern[1]);
    y = cleanTerm(relationPattern[2]);
  } else {
    x = cleanTerm(input);
    y = "企业结果变量";
  }

  const normalizedTopic = `${x} 对 ${y} 的影响`;

  return {
    normalizedTopic,
    independentVariable: `${x}`,
    dependentVariable: `${y}`,
    researchObject: "A 股上市公司",
    relationship: "因果影响",
    confirmationMessage: `我将你的题目理解为：${normalizedTopic}。是否确认？`,
    candidateTopics: [normalizedTopic, `${x} 与 ${y}`, `${x} 是否会影响 ${y}？`]
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
    purpose: "在回归之前完成变量类型、缺失值和极端值的基础清洗。",
    meaning: `围绕当前题目，先把 ${input.dependentVariable}、${input.independentVariable} 以及控制变量整理成可直接进入 Stata 回归的形式。`,
    variableDesign: uniqueVars.map((item) => `检查 ${item} 是否为数值型、是否存在异常值和缺失值`),
    modelSpec: "本阶段不估计正式模型，重点是把数据整理干净。",
    stataCode: [
      `destring ${uniqueVars.join(" ")}, replace force`,
      `drop if missing(${[input.dependentVariable, input.independentVariable, ...input.controls.slice(0, 2)].filter(Boolean).join(", ")})`,
      logStatements,
      `winsor2 ${uniqueVars.join(" ")}, replace cuts(1 99)`
    ].join("\n"),
    codeExplanation: [
      "destring 用于把字符串型变量转换成数值型变量。",
      "drop if missing 用于删除核心变量缺失的样本。",
      "对数处理一般用于规模类变量或右偏分布较明显的变量。",
      "winsor2 用于对 1% 和 99% 分位数进行缩尾，降低极端值影响。"
    ],
    interpretationGuide: [
      "清洗完成后建议先运行 summarize，确认变量分布是否合理。",
      "如果本地没有 winsor2，请先执行 ssc install winsor2, replace。"
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
    filePath: `D:\\results\\${moduleName}.doc`,
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
    const installHint = command === "reghdfe"
      ? "ssc install reghdfe, replace\nssc install ftools, replace"
      : command === "outreg2"
        ? "ssc install outreg2, replace"
        : `ssc install ${command}, replace`;
    return {
      errorType: "command_not_found",
      explanation: `${command} 尚未安装到当前 Stata 环境中。`,
      fixCode: installHint,
      retryMessage: "先安装命令，再重新运行原始代码；如果仍有报错，再把完整报错贴回来。"
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
