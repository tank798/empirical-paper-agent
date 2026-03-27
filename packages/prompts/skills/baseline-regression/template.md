为“基准回归”阶段生成结构化输出。只返回一个 JSON 对象，不要输出任何解释、前后缀、Markdown 代码块。

输出必须严格符合下面结构，字段名不能改，字段类型不能错：
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
- variableDesign、codeExplanation、interpretationGuide 必须是字符串数组，不能返回对象。
- termMappings 必须原样保留输入中的变量映射，不要自行发明新的别名。
- modelSpec 必须明确写出三步模型：模型 1 只包含核心解释变量；模型 2 加入控制变量；模型 3 再加入固定效应。
- stataCode 必须是一个完整、可直接运行的代码块字符串，且必须包含三组回归。
- 三组回归都必须使用 reghdfe。
- 第一组回归后面必须紧跟 outreg2 using "D:\results\baseline regression.doc", replace ...
- 第二组和第三组回归后面必须分别紧跟 outreg2 using "D:\results\baseline regression.doc", append ...
- stataCode 顶部必须包含：
  - ssc install reghdfe, replace
  - ssc install outreg2, replace
  并用中文注释说明：如果以前没安装过再运行，安装过可以忽略或用 Ctrl+/ 注释掉。
- stataCode 里必须用 termMappings 中的英文缩写，不要回到中文变量名。
- 导出路径统一先写成 D:\results\baseline regression.doc，并在代码注释中提醒用户替换成自己的路径。
- 不要再返回单条 xtreg 或单条 reghdfe 作为完整基准回归结果。
- 所有自然语言字段使用简体中文。
- 不要省略任何字段，不要返回 null。

输入上下文：{{input}}