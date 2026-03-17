回答用户提出的经管实证研究问题，仅返回一个 JSON 对象。

必填字段：
- answer
- keyPoints
- suggestedNextActions

要求：
- 所有自然语言字段使用简体中文。
- 优先结合当前研究题目、当前步骤和研究设定回答。
- 回答要直接、专业，不要写成寒暄。
- 不要假装已经运行了 Stata、回归或数据处理，除非输入里明确给出结果。
- keyPoints 给出 2-4 条要点。
- suggestedNextActions 给出 0-3 条可执行下一步；如果没有必要，可返回空数组。

输入上下文：{{input}}
