# 经管实证论文 AI Agent

一个面向经管 / 管理 / 金融实证论文场景的 AI 工作台。用户可以输入研究主题、变量设定、开题报告片段、数据字典或 Stata 问题，系统会先整理成结构化研究设定，再生成可阅读、可复制、可继续追问的 Stata 工作流。

当前版本的重点迭代是：从“WorkflowService 正则 / 关键词 / 当前阶段规则路由”的旧链路，收敛到“一个 Research Agent 统一理解用户输入，并通过工具更新项目状态或生成工作流”的新链路；同时补充了多源上下文处理能力，支持长文本材料、多个附件和历史上传内容的可控回看。

## 架构迭代

```mermaid
flowchart TD
  A["旧链路\n正则 / 关键词 / 当前阶段规则路由\n分散调用阶段 Skill"] --> B["迭代为"]
  B --> C["新链路\n多源输入预处理 → Research Agent 统一决策 → 工具调用 → 工作流生成"]
```

## 项目做了什么

- **研究设定抽取**：从自然语言、开题报告、数据字典、图片 OCR 等输入中抽取研究主题、解释变量、被解释变量、研究对象、控制变量、样本区间、固定效应、面板字段和聚类变量。
- **统一 Agent 调度**：`research-agent.md` 负责判断用户是在闲聊、问科研问题、补充研究设定、要求生成工作流，还是要求重生成某个模块。
- **多源上下文处理**：用户文本和每个附件都会作为独立 source 保存。短材料全文注入；长材料先做快速相关性预检，再按片段召回，避免把大段无关文本直接塞进模型。
- **历史材料回看**：系统会为每轮上传或粘贴的材料保存 source index。后续对话中，如果 Agent 判断需要引用此前材料，可以通过 `recall_sources` 工具按问题回看相关片段。
- **可追踪工作流**：每次对话都会创建 `AgentRun`，并记录事件、工具结果、进度和错误，方便调试和展示 Agent 执行过程。
- **确定性 Stata 生成**：主工作流的 Stata 代码由后端模板确定性生成，减少模型随机性，保证同一研究设定下输出更稳定。
- **工作台式 UI**：前端把论文流程拆成主题确认、路径与数据、基准回归、稳健性、内生性、机制、异质性等模块，并支持右侧 AI 助手继续追问。

## 当前主链路

```mermaid
flowchart TD
  A["用户输入\n文本 / 多附件 / 图片 OCR"] --> B["Next.js 前端\napps/web"]
  B --> C["附件解析\nPDF / DOCX / Excel / 图片 OCR"]
  C --> D["/api/proxy"]
  D --> E["NestJS API\napps/api"]
  E --> F["InputSourceService\n多源拆分、长文本预检、分块召回"]
  F --> G["source artifact\n+ 历史 source index"]
  F --> H["ResearchAgentService"]
  H --> I["research-agent.md\n+ 当前研究设定\n+ source index\n+ 工具定义"]
  I --> J["LlmService\nOpenAI 兼容接口"]
  J --> K{"Agent 决策"}
  K -->|"直接回答"| L["自然语言回复"]
  K -->|"需要历史材料"| M["recall_sources"]
  K -->|"补充/修改设定"| N["update_research_profile"]
  K -->|"确认生成工作流"| O["generate_workflow"]
  K -->|"模块调整"| P["regenerate_workflow_module"]
  M --> H
  N --> Q["ResearchProfileService\n研究设定入库"]
  O --> R["WorkflowService + SkillsService"]
  P --> R
  R --> S["workflow-output.builder.ts\n确定性生成 Stata 模块"]
  G --> T[("Postgres / Prisma")]
  Q --> T
  S --> T
  L --> U["Messages + Project Detail"]
  T --> U
  U --> V["项目工作台\n路径、代码、解读、AI 助手"]
  V --> B
```

## 长文本与多附件上下文

本项目不把用户输入和附件简单拼成一段 Prompt，而是先做本地预处理：

1. **独立 source**：用户文本、Word/PDF、Excel、图片 OCR 会分别保存，避免多个附件内容混在一起。
2. **长度分流**：单个 source 不超过 30000 字符时全文进入上下文；超过后进入快速预检。
3. **快速预检**：先读取头部和尾部片段，并在有限范围内扫描经管实证关键词。低相关长文本只注入预览和提示，不做全量分块。
4. **分块召回**：相关长文本按 1500 字符切分，200 字符重叠，最多召回 20 个高分片段。关键词只用于召回材料，不直接决定变量角色。
5. **历史回看**：每轮 source 都会保存为 artifact。后续用户追问“刚才的附件/开题报告里怎么写的”时，Agent 可以调用 `recall_sources` 回看相关材料，再决定是否回答或更新研究设定。

## 页面展示

### 首页输入框

用户进入产品后首先看到的界面，支持文本输入、附件上传（PDF / DOCX / Excel / 图片）和语音输入，Agent 会自动识别输入内容并进入对应的处理流程。

![首页输入框](docs/assets/readme/01-home-chat.png)

### 闲聊场景

当用户输入与科研无关的内容时，Agent 会礼貌地引导用户回到经管实证论文的研究任务上，并提示当前可处理的科研场景。

![闲聊场景](docs/assets/readme/02-chitchat.png)

### 科研问答场景

用户可以直接向 Agent 提问科研概念性问题，例如固定效应、DID、PSM、工具变量或 Stata 语法等，Agent 会直接给出专业解答，无需进入工作流生成流程。

![科研问答场景](docs/assets/readme/03-research-qa.png)

### 研究设定思考过程

用户输入完整的研究需求后，Agent 会在对话中展示思考和理解过程，从自然语言描述中逐步抽取研究主题、变量设定、样本区间等关键信息。右侧「研究设定」面板实时显示已识别和待补充的字段。

![研究设定思考过程](docs/assets/readme/04-research-setup1.png)

### 研究设定卡片

当 Agent 完成研究设定的抽取后，会弹出结构化的研究设定卡片，汇总展示研究主题、解释变量、被解释变量、研究对象、控制变量、固定效应等全部信息。用户可以点击「编辑」微调，或直接「开始」生成完整 Stata 工作流。

![研究设定卡片](docs/assets/readme/04-research-setup2.png)

### 工作流页面

确认研究设定后，系统会生成一套完整的 Stata 工作流，按「主题确认 → 路径与数据 → 基准回归 → 稳健性检验 → 内生性分析 → 机制分析 → 异质性分析」组织为 7 个模块。每个模块展示本节目标、可复制的 Stata 代码，以及右侧的研究设定和变量映射面板。

![工作流页面](docs/assets/readme/05-workflow-module.png)

### 右侧 AI 助手

在工作流的任意模块中，用户都可以打开右侧的 AI 助手面板，针对当前模块的代码或研究思路继续追问、要求修改、补充分析或重新生成，实现工作台内的持续交互。

![右侧 AI 助手](docs/assets/readme/06-workflow-assistant.png)

## 技术栈

- **Frontend**：Next.js 15, React 19, Tailwind CSS
- **Backend**：NestJS, Prisma, PostgreSQL
- **AI**：OpenAI-compatible Chat Completions API, tool calling
- **Monorepo**：pnpm workspace
- **Prompt 管理**：`packages/prompts`
- **共享类型**：`packages/shared`

## 代码结构

```text
apps/
  web/                       Next.js 前端
  api/                       NestJS 后端 API
packages/
  prompts/                   系统 prompt、Research Agent prompt、Skill prompt manifest
  shared/                    前后端共享枚举、schema 和 API 类型
apps/api/src/modules/
  agent/                     当前主 Agent 调度逻辑
  agent/input-source.*        多源输入、长文本分块召回和历史 source 回看
  workflow/                  工作流推进与批量生成
  skills/                    Skill registry、执行器、确定性 Stata 输出模板
  research-profile/          研究设定、变量映射和数据字典处理
  harness/                   Agent run、事件、工具结果和 artifact 记录
```

## Prompt 资产

当前主链路最关键的是：

- `packages/prompts/agent/research-agent.md`：Research Agent 的主行为准则，决定直接回答还是调用工具。
- `packages/prompts/common/system.md`：Skill 调用时的通用系统约束。
- `packages/prompts/src/index.ts`：prompt manifest，运行时通过它找到具体 markdown 文件。

运行时会额外注入当前研究设定、历史输入源索引、本轮 source 处理结果和工具定义。长文本材料不会直接完整塞进 Prompt，而是由后端上下文层先压缩成可控片段；需要回看历史材料时，再由 Agent 主动调用 `recall_sources`。

部分旧 Skill prompt 仍保留，用于兼容、测试和直接调用，例如：

- `packages/prompts/skills/workflow-input-interpreter/template.md`
- `packages/prompts/skills/general-research-chat/template.md`
- `packages/prompts/skills/result-interpret/template.md`
- `packages/prompts/skills/stata-error-debug/template.md`

## 本地运行

安装依赖：

```bash
corepack pnpm install
```

配置后端环境变量：

```bash
cp apps/api/.env.example apps/api/.env
```

至少需要：

```env
DATABASE_URL="postgresql://..."
OPENAI_API_KEY="..."
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_MODEL="gpt-4.1-mini"
```

初始化 Prisma：

```bash
corepack pnpm --filter api prisma:generate
corepack pnpm --filter api prisma:migrate
```

启动后端：

```bash
corepack pnpm --filter api start:dev
```

启动前端：

```bash
corepack pnpm --filter web dev
```

如果本地 `3000` 端口已被占用，可以改用：

```bash
cd apps/web
./node_modules/.bin/next dev -p 3001
```

默认本地地址：

- Frontend: `http://localhost:3000`
- API: `http://localhost:4000/api`

前端通过 `apps/web/app/api/proxy/[...path]/route.ts` 代理到后端。未来部署时可设置 `API_BASE_URL` 或 `NEXT_PUBLIC_API_BASE_URL`。

## 当前状态

- GitHub `main` 是当前前端部署来源。
- Vercel 前端部署使用 `apps/web` 作为 root directory。
- Railway 后端自动部署已停用；后端目前按本地或未来自定义托管方式运行。
