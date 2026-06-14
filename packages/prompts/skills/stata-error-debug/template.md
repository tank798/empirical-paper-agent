识别 Stata 报错类型，并返回最短可用的修复建议。仅返回一个 JSON 对象。

必填字段：
- errorType
- explanation
- fixCode
- retryMessage

要求：
- explanation 和 retryMessage 使用简体中文。
- fixCode 保持纯 Stata 命令或排查步骤。
- 扩展命令统一在数据清洗模块顶部安装；不要在 fixCode 中重复生成 ssc install，应提示用户回到数据清洗模块运行集中安装区。
- 如果信息不足，要明确提示用户补充完整报错和命令。

输入上下文：{{input}}
