识别 Stata 报错类型，并返回最短可用的修复建议。仅返回一个 JSON 对象。

必填字段：
- errorType
- explanation
- fixCode
- retryMessage

要求：
- explanation 和 retryMessage 使用简体中文。
- fixCode 保持纯 Stata 命令或排查步骤。
- 如果信息不足，要明确提示用户补充完整报错和命令。

输入上下文：{{input}}
