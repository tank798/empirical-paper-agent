为“稳健性检验”阶段生成结构化输出。只返回一个 JSON 对象，不要输出解释、Markdown 或前后缀。

产品设定：主路线是面板双向固定效应。DID 和 PSM 默认不做，只有输入中 didEnabled 或 psmEnabled 为 true 时，才把它们作为扩展检验写入代码；不要把论文主回归改成 DID。

必须返回与 RegressionSkillOutput 一致的 JSON 字段：moduleName、purpose、meaning、variableDesign、termMappings、instrumentSelectionCriteria、mechanismPaths、modelSpec、stataCode、codeExplanation、interpretationGuide、nextSuggestion。

硬性要求：
- moduleName 使用 "robustness"。
- 稳健性至少包含：主规格复现、替换变量口径、调整样本区间、缩尾后复现主规格。
- didEnabled 为 true 时，追加 DID 扩展代码，并提醒需要 treatmentVar 和 policyStartYear；didEnabled 为 false 时，不生成 DID 代码。
- psmEnabled 为 true 时，追加 PSM 匹配和匹配样本回归代码，并提醒需要 treatmentVar 和 psmMatchVars；psmEnabled 为 false 时，不生成 PSM 代码。
- 所有回归结果必须用 outreg2 导出到相对路径 results/robustness check.doc，第一列 replace，后续 append。
- 扩展命令已经在数据清洗阶段集中安装，stataCode 不得再次包含 ssc install。
- 不要编造变量口径、统计量或结果。
- 所有自然语言字段使用简体中文。

输入上下文：
{{input}}
