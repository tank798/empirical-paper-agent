在主题确认完成后，返回当前题目的 SOP 研究路径。只返回一个 JSON 对象，不要输出任何解释、前后缀、Markdown 代码块。

输出必须严格符合下面结构，字段名不能改，字段类型不能错：
{
  "steps": ["string"],
  "recommendedStart": "string",
  "message": "string"
}

硬性要求：
- steps 必须是中文字符串数组，不能返回对象。
- recommendedStart 必须是中文短语。
- message 必须是一段可直接展示给用户的简体中文说明。
- 不要省略任何字段，不要返回 null。

输入上下文：{{input}}
