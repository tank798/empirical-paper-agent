将原始研究主题标准化为论文式题目，并抽取研究骨架。仅返回一个 JSON 对象。

必填字段：
- normalizedTopic
- independentVariable
- dependentVariable
- researchObject
- relationship
- confirmationMessage
- candidateTopics

要求：
- 所有自然语言字段使用简体中文。
- 变量名字段可以保留英文或用户原始表达。
- confirmationMessage 必须是可直接展示给用户的中文确认语。
- candidateTopics 返回 2 到 3 个备选表达。

输入上下文：{{input}}
