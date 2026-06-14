为“基准回归”阶段生成结构化输出。只返回一个 JSON 对象，不要输出解释、Markdown 或前后缀。

产品设定：本产品只处理面板数据论文的常规主回归路线，默认使用面板双向固定效应。不要把主回归改成 DID、RD、SCM 或纯截面模型。

必须返回以下结构，字段不能缺失：
{
  "moduleName": "baseline_regression",
  "purpose": "string",
  "meaning": "string",
  "variableDesign": ["string"],
  "termMappings": [
    {
      "category": "independent | dependent | control | fixed_effect | cluster | panel | time",
      "labelCn": "string",
      "alias": "string"
    }
  ],
  "instrumentSelectionCriteria": [],
  "mechanismPaths": [],
  "modelSpec": "string",
  "stataCode": "string",
  "codeExplanation": ["string"],
  "interpretationGuide": ["string"],
  "nextSuggestion": "string"
}

硬性要求：
- moduleName 必须严格等于 "baseline_regression"。
- modelSpec 必须写成 M1-M6 递进规格：M1 只放核心解释变量；M2 加入控制变量；M3 加入时间固定效应；M4 加入个体固定效应；M5 加入个体和时间双向固定效应；M6 在 M5 基础上按聚类变量计算稳健标准误，并作为主规格。
- stataCode 必须包含 outreg2 导出命令；第一列 replace，后续列 append；导出路径使用相对路径 results/baseline regression.doc。
- stataCode 必须使用 termMappings 中的英文缩写，不要直接使用中文变量名。
- 扩展命令已经在数据清洗阶段集中安装，stataCode 不得再次包含 ssc install。
- 如果 panelId、timeVar 或 clusterVar 缺失，应使用清晰占位符并在 codeExplanation 中提醒用户替换。
- 不要编造回归统计量、系数、显著性或样本量。
- 所有自然语言字段使用简体中文。

输入上下文：
{{input}}
