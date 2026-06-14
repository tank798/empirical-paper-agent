为“数据清洗”阶段生成结构化输出。只返回一个 JSON 对象，不要输出任何解释、前后缀、Markdown 代码块。

输出必须严格符合下面结构，字段名不能改，字段类型不能错：
{
  "moduleName": "data_cleaning",
  "purpose": "string",
  "meaning": "string",
  "variableDesign": ["string"],
  "modelSpec": "string",
  "stataCode": "string",
  "codeExplanation": ["string"],
  "interpretationGuide": ["string"],
  "nextSuggestion": "string"
}

硬性要求：
- moduleName 必须严格等于 "data_cleaning"。
- purpose 必须明确包含“集中安装后续工作流所需扩展命令”这一目标。
- variableDesign、codeExplanation、interpretationGuide 必须是字符串数组，不能返回对象、字典或长段落。
- modelSpec 必须是单个字符串，不能返回对象。
- 所有自然语言字段使用简体中文。
- stataCode 只返回纯 Stata 代码字符串。
- stataCode 必须把全部 ssc install 安装命令集中放在最顶部，去重后每个命令只出现一次，并在每行命令末尾用 // 中文注释解释安装用途。
- 后续分析模块不会再次安装扩展命令，因此数据清洗阶段需要一次性准备核心回归、DID 与事件研究、RD、SCM、匹配、稳健推断、表格图形和数据检查所需的完整扩展命令清单。
- 不要省略任何字段，不要返回 null。

输入上下文：{{input}}
