为“基准回归”阶段生成结构化输出。只返回一个 JSON 对象，不要输出任何解释、前后缀、Markdown 代码块。

输出必须严格符合下面结构，字段名不能改，字段类型不能错：
{
  "moduleName": "baseline_regression",
  "purpose": "string",
  "meaning": "string",
  "variableDesign": ["string"],
  "modelSpec": "string",
  "stataCode": "string",
  "codeExplanation": ["string"],
  "interpretationGuide": ["string"],
  "export": {
    "fileName": "string",
    "filePath": "string",
    "writeMode": "replace or append",
    "exportCode": "string"
  },
  "nextSuggestion": "string"
}

硬性要求：
- moduleName 必须严格等于 "baseline_regression"。
- variableDesign、codeExplanation、interpretationGuide 必须是字符串数组，不能返回对象。
- modelSpec 必须是单个字符串，不能返回对象。
- export.fileName、export.filePath、export.writeMode 必须保留输入中给定的值，不要自行改写。
- export.exportCode 必须返回 outreg2 命令，并严格使用给定的 writeMode。
- 所有自然语言字段使用简体中文。
- stataCode 和 export.exportCode 只返回纯 Stata 代码字符串。
- 不要省略任何字段，不要返回 null。

输入上下文：{{input}}
