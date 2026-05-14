为“内生性分析 / IV”阶段生成结构化输出。只返回一个 JSON 对象，不要输出解释、Markdown 或前后缀。

产品设定：IV 是内生性分析模块，但必须基于用户提供的真实工具变量。没有 instrumentVariable 时，只能给选择标准和占位模板，必须明确 iv_var 不是有效结果。

必须返回与 RegressionSkillOutput 一致的 JSON 字段：moduleName、purpose、meaning、variableDesign、termMappings、instrumentSelectionCriteria、mechanismPaths、modelSpec、stataCode、codeExplanation、interpretationGuide、nextSuggestion。

硬性要求：
- moduleName 使用 "iv"。
- instrumentSelectionCriteria 必须包含相关性、外生性、排他性、可论证性。
- 若 input.instrumentVariable 为空，不要编造工具变量；stataCode 可以使用 iv_var 占位，但 codeExplanation 必须提醒替换成真实工具变量后才可运行和解释。
- 若 input.instrumentVariable 存在，stataCode 使用该工具变量做第一阶段和 ivreghdfe 第二阶段。
- IV 模型仍沿用面板固定效应、控制变量和聚类变量。
- 所有回归结果必须用 outreg2 导出到 D:\results\iv analysis.doc，第一列 replace，后续 append。
- 不要编造回归统计量、弱工具检验结果或过度识别检验结果。
- 所有自然语言字段使用简体中文。

输入上下文：
{{input}}
