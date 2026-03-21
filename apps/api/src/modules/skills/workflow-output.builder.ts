import {
  ExportWriteMode,
  SkillName,
  type DataCheckInput,
  type DataCheckOutput,
  type DataCleaningInput,
  type DataCleaningOutput,
  type GeneralResearchChatInput,
  type GeneralResearchChatOutput,
  type RegressionSkillInput,
  type RegressionSkillOutput,
  type ResultInterpretInput,
  type ResultInterpretOutput,
  type StataErrorDebugInput,
  type StataErrorDebugOutput,
  type TopicNormalizeOutput
} from "@empirical/shared";

type RegressionModuleVariant = "baseline" | "robustness" | "iv" | "mechanism" | "heterogeneity";

function unique(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function buildExportBlock(moduleName: string, input: RegressionSkillInput) {
  const exportState = input.exportState ?? {
    fileName: `${moduleName}.doc`,
    filePath: `D:\\results\\${moduleName}.doc`,
    writeMode: ExportWriteMode.REPLACE
  };

  return {
    fileName: exportState.fileName,
    filePath: exportState.filePath,
    writeMode: exportState.writeMode,
    exportCode: `outreg2 using "${exportState.filePath}", ${exportState.writeMode} bdec(3) tdec(2) adjr2 tstat`
  };
}

function buildCommonVariableDesign(input: RegressionSkillInput) {
  return [
    `被解释变量：${input.dependentVariable}`,
    `核心解释变量：${input.independentVariable}`,
    `控制变量：${input.controls?.length ? input.controls.join("、") : "请按文献口径补充"}`,
    `固定效应：${input.fixedEffects?.length ? input.fixedEffects.join("、") : "企业固定效应、年份固定效应"}`,
    `样本区间：${input.sampleScope || "请补充样本区间"}`
  ];
}

export function buildDataCleaningOutputTemplate(input: DataCleaningInput): DataCleaningOutput {
  const variables = unique([
    input.dependentVariable,
    input.independentVariable,
    ...(input.controls ?? [])
  ]);
  const missingTargets = unique([
    input.dependentVariable,
    input.independentVariable,
    ...(input.controls ?? []).slice(0, 4)
  ]);
  const logCode = (input.needLogVars ?? []).length
    ? input.needLogVars.map((item) => `gen ln_${item} = ln(${item})`).join("\n")
    : "* 如需对规模类变量取对数，可在这里补充 ln 处理";

  return {
    moduleName: "data_cleaning",
    purpose: "先把关键变量整理成可直接进入回归的干净数据。",
    meaning: `这一部分围绕 ${input.independentVariable}、${input.dependentVariable} 以及控制变量完成缺失值、异常值和变量类型处理。`,
    variableDesign: variables.map((item) => `检查 ${item} 的变量类型、缺失值与极端值情况`),
    modelSpec: "本环节不直接回归，重点是把原始数据整理成规范的分析样本。",
    stataCode: [
      `destring ${variables.join(" ")}, replace force`,
      `drop if missing(${missingTargets.join(", ")})`,
      logCode,
      `winsor2 ${variables.join(" ")}, replace cuts(1 99)`
    ].join("\n"),
    codeExplanation: [
      "destring 用于把被错误导入为字符型的变量转成数值型。",
      "drop if missing(...) 用于删除核心变量缺失的样本。",
      "winsor2 用于缩尾处理极端值，减少少量异常观测对回归结果的影响。",
      "如果你的数据没有安装 winsor2，可以先执行 ssc install winsor2, replace。"
    ],
    interpretationGuide: [
      "清洗完成后先运行 summarize，确认变量量级与分布是否合理。",
      "如果某个变量缺失过多，需要回头检查数据源或口径。",
      "正式回归前，确保解释变量、被解释变量和控制变量的样本一致。"
    ],
    nextSuggestion: "数据清洗完成后，下一步建议进入数据检查与描述统计。"
  };
}

export function buildDataCheckOutputTemplate(input: DataCheckInput): DataCheckOutput {
  const keyVariables = unique(input.keyVariables ?? []);
  const lines = ["describe", `summarize ${keyVariables.join(" ")}`];

  if (input.timeVar) {
    lines.push(`tab ${input.timeVar}`);
  }
  if (input.panelId && input.timeVar) {
    lines.push(`xtset ${input.panelId} ${input.timeVar}`);
  }

  return {
    moduleName: "data_check",
    purpose: "确认样本结构、描述统计和面板设定是否可用。",
    meaning: "这一部分主要检查变量分布、年份覆盖、样本量和面板数据结构，避免正式回归时才暴露数据问题。",
    variableDesign: keyVariables.map((item) => `查看 ${item} 的描述统计和分布情况`),
    modelSpec: "本环节仍然以数据核查为主，不直接形成正式回归结论。",
    stataCode: lines.join("\n"),
    codeExplanation: [
      "describe 用于快速查看变量类型、标签和存储格式。",
      "summarize 用于检查关键变量的均值、标准差与极值。",
      input.timeVar ? `tab ${input.timeVar} 用于检查时间维度是否连续。` : "当前没有提供时间变量，因此跳过年份分布检查。",
      input.panelId && input.timeVar
        ? "xtset 用于验证面板设定是否成立。"
        : "若后续要做面板回归，请补充个体维度和时间维度变量。"
    ],
    checkItems: ["变量类型是否正确", "样本量是否合理", "年份覆盖是否完整", "面板结构是否可用"],
    nextSuggestion: "数据检查无误后，就可以进入基准回归。"
  };
}

export function buildRegressionModuleOutput(
  moduleName: string,
  input: RegressionSkillInput,
  moduleLabel: string,
  variant: RegressionModuleVariant
): RegressionSkillOutput {
  const controls = input.controls?.length ? ` ${input.controls.join(" ")}` : "";
  const absorb = input.fixedEffects?.length ? `, absorb(${input.fixedEffects.join(" ")})` : "";
  const cluster = input.clusterVar ? ` vce(cluster ${input.clusterVar})` : "";
  const baseRegression = `reghdfe ${input.dependentVariable} ${input.independentVariable}${controls}${absorb}${cluster}`;
  const exportBlock = buildExportBlock(moduleName, input);

  const baseline: RegressionSkillOutput = {
    moduleName,
    purpose: `${moduleLabel}用于检验核心研究假设是否成立。`,
    meaning: `在当前研究设定下，重点关注 ${input.independentVariable} 对 ${input.dependentVariable} 的方向、显著性和经济含义。`,
    variableDesign: buildCommonVariableDesign(input),
    modelSpec: `${input.dependentVariable} = beta0 + beta1 * ${input.independentVariable} + controls + fixed effects + error`,
    stataCode: baseRegression,
    codeExplanation: [
      "默认使用 reghdfe 估计固定效应模型。",
      input.fixedEffects?.length ? "absorb(...) 用于加入你设定的固定效应。" : "如果尚未明确固定效应，建议至少从企业固定效应和年份固定效应起步。",
      input.clusterVar ? `vce(cluster ${input.clusterVar}) 用于加入聚类稳健标准误。` : "如果样本是企业-年份面板，通常建议按企业层面聚类标准误。"
    ],
    interpretationGuide: [
      "先看核心解释变量的系数方向是否符合理论预期。",
      "再看显著性、样本量和固定效应设定是否稳妥。",
      "最后记录回归表导出路径，方便写论文时直接引用。"
    ],
    export: exportBlock,
    nextSuggestion: "完成基准回归后，可以继续做稳健性、内生性、机制和异质性分析。"
  };

  if (variant === "baseline") {
    return baseline;
  }

  if (variant === "robustness") {
    return {
      ...baseline,
      purpose: "稳健性检验用于确认主结论不依赖某一种特定口径或样本处理方式。",
      meaning: "这一部分通常通过替换变量、缩尾样本、改变固定效应或替换估计方式来验证主结论是否稳定。",
      variableDesign: [
        ...buildCommonVariableDesign(input),
        "可替换核心解释变量口径或缩尾处理样本",
        "可加入或替换固定效应设定进行比较"
      ],
      modelSpec: "围绕基准模型做替代变量、替代样本或替代设定的稳健性检验。",
      stataCode: [
        "* 稳健性检验示例 1：缩尾后重复基准回归",
        `winsor2 ${unique([input.dependentVariable, input.independentVariable, ...(input.controls ?? [])]).join(" ")}, replace cuts(1 99)`,
        baseRegression,
        "",
        "* 稳健性检验示例 2：更换聚类层级或固定效应后再次回归",
        baseRegression
      ].join("\n"),
      codeExplanation: [
        "第一组代码用于确认结果是否被极端值驱动。",
        "第二组代码用于比较不同固定效应和标准误设定下的稳健性。",
        "如果你有替代指标，可以把核心解释变量或被解释变量替换后重复运行。"
      ],
      interpretationGuide: [
        "重点比较核心系数方向是否一致、显著性是否稳定。",
        "如果结果对某个口径非常敏感，需要在论文中单独解释。",
        "稳健性检验不要求系数量级完全一致，但结论方向应尽量稳定。"
      ],
      nextSuggestion: "稳健性结果稳定后，可以继续处理内生性问题。"
    };
  }

  if (variant === "iv") {
    return {
      ...baseline,
      purpose: "内生性分析用于缓解反向因果、遗漏变量或测量误差带来的偏误。",
      meaning: "如果你担心核心解释变量并非完全外生，可以先给出一版工具变量模板，再根据研究场景替换成真正可行的外生冲击。",
      variableDesign: [
        ...buildCommonVariableDesign(input),
        "需要补充一个与核心解释变量相关、但不直接影响结果变量的工具变量"
      ],
      modelSpec: "第一阶段用工具变量解释核心解释变量，第二阶段估计核心解释变量对结果变量的净效应。",
      stataCode: [
        "* 请先把 z_iv 替换成你真正的工具变量",
        `ivreghdfe ${input.dependentVariable} (${input.independentVariable} = z_iv)${controls}${absorb}${cluster}`,
        "estat firststage"
      ].join("\n"),
      codeExplanation: [
        "z_iv 只是占位符，需要替换成真正有理论支撑的工具变量。",
        "ivreghdfe 适合在固定效应框架下做两阶段回归。",
        "estat firststage 用于查看工具变量与核心解释变量的相关性是否足够强。"
      ],
      interpretationGuide: [
        "先看第一阶段工具变量是否显著。",
        "再看第二阶段核心系数方向是否与基准回归一致。",
        "如果工具变量识别不稳，需要重新论证识别策略。"
      ],
      nextSuggestion: "如果工具变量有理论基础，可以继续补充第一阶段和过度识别检验。"
    };
  }

  if (variant === "mechanism") {
    return {
      ...baseline,
      purpose: "机制分析用于回答核心解释变量为什么会影响结果变量。",
      meaning: "这一步需要提出一个理论渠道变量，再验证核心解释变量是否先影响该渠道变量，进而影响结果变量。",
      variableDesign: [
        ...buildCommonVariableDesign(input),
        "请额外补充一个机制变量或中介变量，例如融资约束、信息透明度、治理质量等"
      ],
      modelSpec: "常见做法是先检验核心解释变量对机制变量的影响，再检验引入机制变量后的主回归结果。",
      stataCode: [
        "* 请先把 mediator_var 替换成你的机制变量",
        `reghdfe mediator_var ${input.independentVariable}${controls}${absorb}${cluster}`,
        `reghdfe ${input.dependentVariable} ${input.independentVariable} mediator_var${controls}${absorb}${cluster}`
      ].join("\n"),
      codeExplanation: [
        "第一条回归用于检验核心解释变量是否会显著影响机制变量。",
        "第二条回归用于检验加入机制变量后，主效应是否发生变化。",
        "如果你不做中介链条，也可以改成机制变量分组或渠道识别。"
      ],
      interpretationGuide: [
        "先确认机制变量是否真能代表理论渠道。",
        "再看加入机制变量后，核心系数是否缩小或显著性变化。",
        "机制分析的重点是解释路径，不只是再跑一条回归。"
      ],
      nextSuggestion: "明确理论渠道后，可以继续补充更细的中介变量定义与测量口径。"
    };
  }

  return {
    ...baseline,
    purpose: "异质性分析用于识别不同样本组中效应是否存在系统差异。",
    meaning: "常见做法是按企业规模、地区、产权性质或治理水平分组，或者直接构造交互项。",
    variableDesign: [
      ...buildCommonVariableDesign(input),
      "请额外补充一个分组变量，例如国有/非国有、高污染/非高污染、大企业/小企业"
    ],
    modelSpec: "可以采用分组回归，也可以采用交互项回归比较不同组别的效应差异。",
    stataCode: [
      "* 请先把 group_var 替换成真实分组变量",
      `reghdfe ${input.dependentVariable} ${input.independentVariable}${controls} if group_var == 1${absorb}${cluster}`,
      `reghdfe ${input.dependentVariable} ${input.independentVariable}${controls} if group_var == 0${absorb}${cluster}`,
      `reghdfe ${input.dependentVariable} c.${input.independentVariable}##i.group_var${controls}${absorb}${cluster}`
    ].join("\n"),
    codeExplanation: [
      "前两条回归用于分别查看不同组别的回归结果。",
      "交互项模型用于直接检验两组之间的系数差异。",
      "如果分组变量本身是连续变量，也可以改成分位数组或分组虚拟变量。"
    ],
    interpretationGuide: [
      "重点比较不同组别中核心系数的方向、显著性和量级。",
      "如果交互项显著，可以进一步强调异质性存在。",
      "异质性分析应紧扣理论机制，不建议无差别地堆很多分组。"
    ],
    nextSuggestion: "异质性分析完成后，可以回到论文结构中整合主结论与扩展检验。"
  };
}

export function buildTopicNormalizeOutputTemplate(rawTopic: string): TopicNormalizeOutput {
  const trimmed = rawTopic.trim();
  const match = trimmed.match(/^(.+?)(?:对|与|和)(.+?)(?:的)?(?:影响|效应|关系)(?:研究)?$/);
  const independentVariable = match?.[1]?.trim() || trimmed || "核心解释变量";
  const dependentVariable = match?.[2]?.trim() || "被解释变量";
  const normalizedTopic = match
    ? `${independentVariable}对${dependentVariable}的影响研究`
    : trimmed || "待确认的研究主题";

  return {
    normalizedTopic,
    independentVariable,
    dependentVariable,
    researchObject: "",
    relationship: "正向、负向和不显著",
    confirmationMessage: "我已经先整理出一版研究设定。",
    candidateTopics: [normalizedTopic]
  };
}

export function buildGeneralResearchChatFallback(input: GeneralResearchChatInput): GeneralResearchChatOutput {
  const prefix = input.topic ? `结合当前研究“${input.topic}”，` : "";

  if (/固定效应/.test(input.userQuestion)) {
    return {
      answer: `${prefix}固定效应的作用，是控制那些不随时间变化但会持续影响结果变量的个体差异，以及同一时期的共同冲击。企业固定效应和年份固定效应，是经管面板回归里最常见的起点。`,
      keyPoints: [
        "企业固定效应控制企业层面不随时间变化的遗漏因素。",
        "年份固定效应控制宏观周期和共同政策冲击。",
        "如果你的核心变量主要在企业和年份两个维度变化，双固定效应通常是比较稳妥的起点。"
      ],
      suggestedNextActions: ["明确个体维度和时间维度变量分别是什么。", "再确认是否需要行业或地区固定效应。"]
    };
  }

  if (/控制变量/.test(input.userQuestion)) {
    return {
      answer: `${prefix}控制变量的目标，是缓解遗漏变量偏误。通常优先纳入文献中常见、并且理论上会同时影响解释变量和结果变量的企业特征与财务特征。`,
      keyPoints: [
        "优先选择文献中常见且理论相关的控制变量。",
        "每个控制变量都要有清晰口径，避免和核心解释变量高度重合。",
        "变量数量要和样本量、共线性风险一起考虑。"
      ],
      suggestedNextActions: ["先列出 5 到 8 个最常见控制变量。", "逐个确认变量定义、计算方式和数据来源。"]
    };
  }

  if (/内生性/.test(input.userQuestion)) {
    return {
      answer: `${prefix}内生性通常来自反向因果、遗漏变量或测量误差。通常先把基准回归、固定效应和稳健性检验做好，再决定是否需要工具变量、双重差分或其他更强的识别策略。`,
      keyPoints: [
        "先判断内生性的来源，再选处理方法。",
        "工具变量、DID、自然实验都需要额外的识别逻辑。",
        "如果识别策略解释不清，再复杂的方法也站不住。"
      ],
      suggestedNextActions: ["先说明你最担心的是哪一种内生性。", "再看当前题目有没有合适的外生冲击或工具变量。"]
    };
  }

  return {
    answer: `${prefix}这个问题可以从研究设定、变量构建和识别策略三个层面来理解。你可以继续把问题说得更具体一点，我会结合当前模块帮你拆解。`,
    keyPoints: [
      "先判断这属于概念问题、变量问题，还是识别策略问题。",
      "尽量把提问和当前题目、样本、变量设定挂钩。",
      "如果问题和当前模块直接相关，优先补足能推进下一步的信息。"
    ],
    suggestedNextActions: ["可以继续追问某个变量、某条代码或某种识别策略。"]
  };
}

export function buildResultInterpretFallback(input: ResultInterpretInput): ResultInterpretOutput {
  const significant = /\*\*\*|\*\*|\*|p\s*</i.test(input.resultText);
  return {
    plainExplanation: significant
      ? "从当前结果看，核心解释变量已经呈现出统计上显著的影响，初步支持研究假设。"
      : "从当前结果看，核心解释变量暂时没有表现出稳定的统计显著性，还不能直接支持研究假设。",
    paperStyleExplanation: significant
      ? "回归结果表明，核心解释变量与被解释变量之间存在显著关联，为研究假设提供了初步经验支持。"
      : "当前回归结果尚未识别出稳定且显著的核心效应，因此在进一步检验之前，不宜作出过强结论。",
    analysisPoints: ["核心系数方向", "显著性水平", "样本量", "固定效应设定", "标准误设定"],
    missingInfo: [],
    nextSuggestion: "如果你愿意，可以把完整回归表贴给我，我再按论文写法帮你展开解释。"
  };
}

export function buildStataErrorFallback(input: StataErrorDebugInput): StataErrorDebugOutput {
  const errorText = input.errorText.toLowerCase();

  if (errorText.includes("not found") || errorText.includes("command")) {
    return {
      errorType: "command_not_found",
      explanation: "这个报错通常意味着当前 Stata 环境里没有安装对应命令，或者命令名写错了。",
      fixCode: "ssc install reghdfe, replace\nssc install ftools, replace\nssc install outreg2, replace",
      retryMessage: "先安装缺失命令，再重新运行原始代码。"
    };
  }

  if (errorText.includes("variable") || errorText.includes("not found")) {
    return {
      errorType: "variable_not_found",
      explanation: "这个报错更像是变量名不存在、拼写错误，或者当前数据集没有加载该变量。",
      fixCode: "describe\nlookfor variable_name",
      retryMessage: "请先确认变量真实名称，再重新运行代码。"
    };
  }

  return {
    errorType: "stata_error",
    explanation: "我已经识别到这是一条 Stata 报错。建议先检查命令语法、变量名和导出路径。",
    fixCode: input.relatedCode || "请把完整命令和完整报错一起贴给我，我再逐行帮你排查。",
    retryMessage: "如果修正后仍然报错，请把完整报错原文继续发给我。"
  };
}

