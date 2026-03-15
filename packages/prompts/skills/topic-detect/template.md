判断用户输入是否是一个可进入经管实证论文流程的研究主题。仅返回一个 JSON 对象。

必填 JSON 结构：
{
  "isValidTopic": boolean,
  "topicType": "full_topic" | "partial_topic" | "not_topic",
  "needsGuidance": boolean,
  "reason": string,
  "guidanceOptions": string[]
}

分类规则：
- 只有当输入已经包含较明确的解释变量、被解释变量以及作用关系时，才使用 "full_topic"。
- 如果输入像研究主题，但仍缺少变量关系、被解释变量或研究框架，使用 "partial_topic"。
- 如果输入是求助、软件报错、闲聊或非研究主题内容，使用 "not_topic"。
- 不允许返回除 "full_topic"、"partial_topic"、"not_topic" 之外的 topicType 值。
- reason 使用简体中文。
- guidanceOptions 返回 0 到 3 个中文候选研究主题。

输入上下文：{{input}}
