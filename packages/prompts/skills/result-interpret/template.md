解读用户提供的回归结果，仅返回一个 JSON 对象。

必填字段：
- plainExplanation
- paperStyleExplanation
- analysisPoints
- missingInfo
- nextSuggestion

要求：
- 所有自然语言字段使用简体中文。
- 不要编造未给出的统计量。
- 如果结果文本缺少关键信息，把缺失项写入 missingInfo。

输入上下文：{{input}}
