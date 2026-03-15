# 经管科研论文 Agent PRD 与部署方案

## 一、产品定位

这是一个面向经管、金融、会计等实证研究场景的对话式研究 Agent。它不是一个泛用聊天机器人，而是一个围绕经管论文实证 SOP 设计的研究助手，帮助用户从研究主题确认、变量设计、模型设定，到 Stata 代码生成与解释，逐步完成论文实证部分。

核心目标是把“不会做题目、不会搭框架、不会写 Stata、不会解释实证逻辑”的过程，产品化为一个低门槛、强引导、可复用的对话流程。

---

## 二、目标用户

主要面向 **正在做经管实证论文的学生**，尤其是：

- 本科毕业论文
- 硕士论文
- 博士课程论文
- 实证方法课程作业

这些用户通常有一个共同问题：

- 有研究想法，但不知道如何变成可实证的题目
- 不清楚实证论文的标准结构
- 不会写或不理解 Stata 代码
- 回归结果出来后不会解释

本产品的目标就是：**像老师或学长一样，带着用户一步一步把实证做出来。**

---

## 三、产品价值主张

核心价值只有一句话：

**让不会做实证论文的人，也能一步一步完成实证部分。**

具体体现在三个方面：

1. **研究流程清晰**\
   用户只需要跟着步骤走： 研究主题 → 数据清洗 → 数据检查 → 基准回归 → 稳健性 → 机制 → 异质性 → 内生性。

2. **代码直接可用**\
   每一步都提供可以直接复制的 Stata 代码。

3. **结果有人帮你读**\
   用户把回归结果发回来，Agent 会解释：

   - R²
   - 核心变量显著性
   - 结果是否支持研究假设

---



---

## 四、产品形态

整体形态采用首页大输入框 + 对话式展开，风格类似轻量聊天产品。

### 首页核心元素

- 品牌标题
- 一句价值主张
- 一个大输入框
- 若干示例研究主题按钮
- 历史项目入口

### 首页建议文案

主标题： **请先告诉我你的研究主题**

副标题： **我会一步步帮你完成经管实证论文设计、Stata 实现与结果解释**

输入框 placeholder： **例如：金融监管对企业 ESG 的影响 / 数字金融对企业创新的影响 / 环境规制对绿色转型的影响**

示例按钮：

- 金融监管对企业 ESG 的影响
- 数字金融对企业创新的影响
- ESG 表现对企业融资成本的影响
- 环境规制对绿色创新的影响

---

## 五、核心交互逻辑

产品的关键不是“聊天”，而是“状态驱动的研究流程”。

### 状态 1：主题识别

任务：判断用户输入是不是一个合格的研究主题。

#### 情况 A：用户输入的是完整主题

例如：

- 金融监管对企业 ESG 的影响
- 数字金融对企业创新的影响

系统回复：

> 我理解您的研究主题是“金融监管对企业 ESG 的影响”，对吗？

#### 情况 B：用户输入的是领域，不是主题

例如：

- ESG
- 企业创新
- 金融监管

系统回复：

> 目前这更像是一个研究领域，还不是完整研究主题。一个可实证的题目通常至少包含解释变量和被解释变量。您可以试着用“X 对 Y 的影响”这种格式告诉我。

同时给出推荐：

- 金融监管对企业 ESG 的影响
- ESG 表现对企业融资成本的影响
- 数字金融对企业创新的影响

#### 情况 C：用户输入不是主题

例如：

- 帮我写 Stata
- 我不会做论文
- 这个变量怎么构造

系统回复：

> 我们先确定研究主题，再进入模型与代码会更高效。请先告诉我您想研究什么问题。

---

### 状态 2：主题标准化与确认

用户输入常常不规范，例如：

- 金融监管与企业 ESG
- ESG 和金融监管
- 研究金融监管会不会影响企业 ESG

系统需要自动标准化为：

**金融监管对企业 ESG 的影响**

并补出基础研究骨架：

- 解释变量：金融监管强度
- 被解释变量：企业 ESG 表现
- 研究对象：例如 A 股上市公司
- 研究关系：影响效应

确认模板：

> 您要研究的主题是“金融监管对企业 ESG 的影响”，对吗？

---

### 状态 3：SOP 导航

确认主题后，不立刻丢代码，而是先给整体研究路径，让用户知道会发生什么。

建议文案：

> 好的，主题已确认。后续我会按照标准经管实证流程，带您逐步完成：
>
> 数据清洗 → 数据检查 → 基准回归 → 稳健性检验 → 机制分析 → 异质性分析 → 内生性检验
>
> 每一步我都会解释：
>
> 1. 这一步在论文里是做什么的
> 2. 在您的主题下意味着什么
> 3. 变量和模型如何设定
> 4. Stata 代码怎么写
> 5. 代码每一行是什么意思

并给出按钮：

- 开始基准回归
- 先看整体研究框架
- 我想先看变量设计

---

### 状态 4：模块执行

每个模块都按照固定模板输出，保证一致性与可理解性。

统一模板如下：

1. 这一步的研究目的
2. 在该主题下的具体含义
3. 推荐变量设计
4. 模型表达式
5. Stata 代码
6. 代码解释
7. 常见问题与注意点
8. 下一步建议

---

## 六、论文 SOP 设计

在进行任何回归之前，需要先完成**数据清洗（Data Cleaning）**。很多实证问题其实不是回归本身，而是数据格式或缺失值问题。因此本产品会在基准回归之前先带用户做基础数据清理。

### 模块 0：数据清洗（Data Cleaning）

#### 功能定位

在正式回归之前，先确保数据格式正确、缺失值处理合理、极端值不会影响回归结果。

#### 常见数据清理步骤

1. **字符串变量转为数值变量（destring）**
2. **删除关键变量缺失值**
3. **生成常见对数变量（log transformation）**
4. \*\*上下1%缩尾处理（winsorize）

#### 示例代码

```stata
* 1. 字符串变量转数值
 destring esg finance_reg size lev roa growth, replace force

* 2. 删除关键变量缺失值
 drop if missing(esg, finance_reg, size, lev)

* 3. 生成常见对数变量（示例）
 gen ln_size = ln(size)

* 4. 1% 和 99% 缩尾
* 如果提示 winsor2 未安装：
* ssc install winsor2
winsor2 esg finance_reg size lev roa growth, replace cuts(1 99)
```

#### 代码解释

- `destring`：将字符串变量转为数值变量
- `drop if missing()`：删除关键变量缺失的样本
- `winsor2`：对变量进行上下1%缩尾，减少极端值影响

#### 结果确认

完成数据清洗后，建议用户简单检查数据：

```stata
summarize esg finance_reg size lev roa growth
```

确认变量没有明显异常值或缺失问题。

---

### 模块 0.5：数据检查（Data Check）

#### 功能定位

在完成基础清洗后，先检查数据的基本结构是否合理，避免带着错误数据直接进入回归。

#### 建议检查内容

1. **查看变量类型与数据结构**
2. **查看核心变量描述性统计**
3. **查看年份分布是否合理**
4. **如果是面板数据，检查公司与年份维度是否基本完整**

#### 示例代码

```stata
* 1. 查看变量类型和标签
 describe

* 2. 查看核心变量描述性统计
 summarize esg finance_reg size lev roa growth

* 3. 查看年份分布
 tab year

* 4. 如果是面板数据，可检查公司和年份
 xtset firm_id year
```

#### 代码解释

- `describe`：查看数据集中所有变量的类型、格式和标签
- `summarize`：查看核心变量的均值、标准差、最小值、最大值等
- `tab year`：检查样本年份是否完整，是否有异常年份
- `xtset firm_id year`：声明面板数据结构，并检查企业-年份维度是否合理

#### 结果确认

完成数据检查后，Agent 可以引导用户确认：

- 变量是否已经是数值型
- 样本量是否明显过少
- 年份是否连续
- 面板数据是否可以正常设定

如果检查无异常，再进入基准回归。

---

### 模块 1：基准回归

#### 功能定位

这是整篇实证论文的起点，用来检验核心假设是否成立。

#### 在主题“金融监管对企业 ESG 的影响”下的含义

先看金融监管变量是否显著影响 ESG。

#### 输出内容

- 研究假设的白话解释
- 核心变量识别
- 控制变量建议
- 固定效应建议
- Stata 基础回归代码
- 高阶固定效应代码
- 系数如何解释
- 回归表导出代码

#### 示例代码

⚠️ **命令安装提示（按需提示）**\
如果运行下面代码时出现 `command reghdfe not found`，说明你的 Stata 还没有安装该扩展命令，可以先运行：

```stata
ssc install reghdfe, replace
ssc install ftools, replace
```

安装完成后再重新运行回归代码。

#### 示例代码

```stata
reghdfe esg finance_reg size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)
```

#### 导出结果表示例

如果 Stata 提示 `outreg2` 未安装，可以先运行：

```stata
ssc install outreg2, replace
```

然后导出结果表：

```stata
outreg2 using "D:\充实且快乐\paper\毕业论文\code\返稿修改V1\结果\baseline.doc", replace tdec(2) bdec(3) adjr2 tstat addtext(Industry FE, YES, Year FE, YES)
```

#### 解释结构

- `esg` 是被解释变量
- `finance_reg` 是核心解释变量
- `size lev roa growth board dual` 是控制变量
- `absorb(year industry)` 表示控制年份和行业固定效应
- `vce(cluster firm_id)` 表示按企业聚类稳健标准误
- `outreg2` 用于导出论文结果表

---

### 模块 2：稳健性检验

#### 功能定位

验证基准回归结果不是由变量口径、样本选择或极端值处理导致的偶然结果。

#### 本产品只提供三种最常见且最容易理解的稳健性方法

1. **变量替换**（替换被解释变量或核心解释变量）
2. **改变样本区间**（例如剔除某些年份）
3. **缩尾处理（winsorize）**

#### 示例代码

**1. 变量替换示例**

```stata
reghdfe esg_alt finance_reg size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)
```

**2. 改变样本区间示例**（例如只使用2010年之后样本）

```stata
reghdfe esg finance_reg size lev roa growth board dual if year>=2010, absorb(year industry) vce(cluster firm_id)
```

**3. 缩尾处理示例**

```stata
* 如果 Stata 提示 winsor2 未安装，可以先运行：
* ssc install winsor2
winsor2 esg finance_reg size lev roa growth board dual, replace cuts(1 99)
reghdfe esg finance_reg size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)
```

#### 代码解释

- `winsor2` 用于对变量进行1%和99%的缩尾
- `if year>=2010` 表示只使用2010年之后的数据
- `esg_alt` 表示替代的ESG指标

#### 结果分析交互

Agent 在用户运行代码后需要询问：

> 代码跑出结果了吗？把结果发给我看看，我来帮你分析。重点会看：R²、核心解释变量的显著性和方向，以及其他重要信息。

重点解释三件事：

1. **R²（决定系数）**：模型解释能力如何
2. **核心解释变量系数的方向与显著性**：是否支持研究假设
3. **控制变量与整体模型信息**：例如样本量、固定效应等

---

### 模块 3：机制分析

#### 功能定位

解释为什么会产生该影响。

本产品只提供两种最经典、最常见的机制方式：

1. **中介效应（mediation）**
2. **调节效应（moderation）**

#### 中介效应示例

第一步：核心解释变量影响中介变量

```stata
reghdfe mediator finance_reg size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)
```

第二步：加入中介变量

```stata
reghdfe esg finance_reg mediator size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)
```

#### 调节效应示例

```stata
gen interaction = finance_reg*moderator
reghdfe esg finance_reg moderator interaction size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)
```

#### 代码解释

- `mediator` 为中介变量
- `moderator` 为调节变量
- `interaction` 为交互项

#### 结果分析交互

Agent 需要询问：

> 结果跑出来了吗？把结果发给我看看，我来帮你分析。重点会看：R²、核心解释变量的显著性和方向，以及其他重要信息。

重点解释：

1. 核心变量是否仍然显著
2. 中介变量或交互项是否显著
3. 系数方向是否符合理论预期

---

### 模块 4：异质性分析

#### 功能定位

检验该影响在不同类型企业中是否存在差异。

本产品默认使用 **在基准回归基础上加 if 条件进行分组回归**。

#### 示例代码

例如：国企 vs 民企

```stata
reghdfe esg finance_reg size lev roa growth board dual if soe==1, absorb(year industry) vce(cluster firm_id)

reghdfe esg finance_reg size lev roa growth board dual if soe==0, absorb(year industry) vce(cluster firm_id)
```

#### 代码解释

- `soe==1` 表示国企
- `soe==0` 表示民企

#### 结果分析交互

Agent 会询问：

> 两组结果跑出来了吗？把两个回归结果都发给我看看，我来帮你比较差异。重点会看：R²、核心解释变量的显著性和方向，以及组间差异。

重点解释：

1. 两组样本核心变量系数是否不同
2. 哪一组显著
3. 经济含义如何解释

---

### 模块 5：内生性检验

#### 功能定位

解决反向因果或遗漏变量问题。

本产品默认只讲一种方法：**工具变量法（IV）**。

#### 示例代码

```stata
* 如果 Stata 提示 ivreghdfe 未安装，可以先运行：
* ssc install ivreghdfe
ivreghdfe esg (finance_reg = iv_variable) size lev roa growth board dual, absorb(year industry) cluster(firm_id)
```

#### 代码解释

- `finance_reg` 是内生变量
- `iv_variable` 是工具变量
- `ivreghdfe` 用于工具变量回归

#### 结果分析交互

Agent 在用户运行代码后需要询问：

> IV 回归结果出来了吗？把结果发给我看看，我来帮你分析。重点会看：第一阶段、第二阶段、核心解释变量的显著性和方向，以及其他重要信息。

重点解释：

1. 第一阶段是否显著
2. 第二阶段核心变量系数方向
3. 工具变量是否合理

---

## 七、每一步的输出格式建议

为了让产品更像“研究教练”而不是“代码机器”，每一步推荐统一为下面的版式：

### 1. 这一步在论文里是做什么的

用白话解释。

### 2. 在你的题目下意味着什么

与具体主题绑定。

### 3. 建议的变量与模型设定

明确解释变量、被解释变量、控制变量、固定效应。

### 4. Stata 代码

提供可以直接复制的版本。

### 5. 代码逐行解释

降低用户对代码的陌生感。

### 6. 结果怎么看

告诉用户系数方向、显著性、经济含义怎么写。

### 7. 下一步去哪

自然引导进入下一个模块。

---

## 八、Prompt 设计思路

### 顶层系统 Prompt 应包含的约束

1. 先判断用户输入是否为研究主题，不可跳步直接写代码。
2. 对不完整主题必须进行引导与补全。
3. 对已确认主题必须先做标准化确认。
4. 所有后续内容都必须围绕该主题展开，不可泛泛而谈。
5. 每个模块都必须输出：解释、变量、模型、Stata 代码、代码解释。
6. 语言风格应兼顾专业性与可理解性，避免只用术语堆砌。
7. 在机制、异质性、内生性部分，必须与主题结合，不能输出空泛模板。
8. 若用户数据条件不足，应明确指出还需要哪些变量或信息。

### 产品层 Prompt 模块

- 主题识别 Prompt
- 主题标准化 Prompt
- SOP 导航 Prompt
- 基准回归模块 Prompt
- 稳健性模块 Prompt
- 机制模块 Prompt
- 异质性模块 Prompt
- 内生性模块 Prompt
- 结果解释模块 Prompt
- 论文写作辅助模块 Prompt

---

## 九、如果做成“人人可用”的产品

这里其实不需要复杂设计，核心只要保证三件事：

1. **用户能马上开始**\
   打开页面就能输入研究主题，不需要学习复杂操作。

2. **研究过程是一步一步被带着走的**\
   从： 研究主题 → 数据清洗 → 数据检查 → 基准回归 → 稳健性 → 机制 → 异质性 → 内生性\
   每一步只解决一个问题，而不是一次给很多内容。

3. **结果可以保存和继续做**\
   用户的研究应该能保存为一个“项目”，下次回来可以继续往下推进。

因此产品最简单的结构其实只有三块：

**1. 首页：输入研究主题**\
用户只需要做一件事：输入题目。

**2. 聊天页：一步一步做实证**\
Agent 按 SOP 引导用户完成每一个实证步骤，并提供 Stata 代码与解释。

**3. 项目列表：保存研究进度**\
用户可以看到自己做过的论文项目，并继续编辑。

只要这三件事做好，这个产品就已经可以被大多数经管学生使用，不需要一开始设计复杂的功能体系。

---

## 十、产品部署建议（采用 Workflow / Skills 方案）

如果你确定要走更专业的路线，那么这款产品不建议只靠一个大 Prompt 驱动，而应该做成：

**LLM + Workflow Engine + Skills + 项目存储**

也就是把整个经管实证流程拆成一组可编排、可复用、可追踪的 Skills，再由 Workflow 负责按步骤调度。

### 一、推荐总体架构

整体可以拆成六层：

1. **前端层**\
   用户输入研究主题、查看对话、复制代码、上传回归结果。

2. **Agent 编排层**\
   负责理解当前用户处于哪个研究阶段，并决定调用哪个 Skill。

3. **Workflow 层**\
   负责管理固定流程： 主题识别 → 主题确认 → 数据清洗 → 数据检查 → 基准回归 → 稳健性 → 机制 → 异质性 → IV → 结果解读

4. **Skills 层**\
   每个关键任务都做成独立 Skill。

5. **模型层**\
   使用大模型生成解释、代码、结果分析。

6. **数据层**\
   保存项目、步骤状态、消息、代码、回归结果、导出文件。

### 二、为什么要用 Workflow / Skills

因为你的产品不是一个普通聊天机器人，而是一个**有固定研究路径的垂直 Agent**。

如果只靠一个 Prompt，会有几个问题：

- 容易跳步
- 容易忘记当前做到哪一步
- 难以稳定输出统一格式
- 后续不好扩展“结果解读”“报错修复”“导出表格”等能力

而 Workflow / Skills 的好处是：

- 每一步都更稳定
- 更容易控制用户流程
- 更容易保存研究进度
- 后续更容易扩展更多研究模块

### 三、推荐的 Skills 拆分

建议至少拆成下面这些 Skill：

#### 1. skill\_topic\_detect

识别用户输入是否为研究主题。

输入：用户原始文本\
输出：

- 是否为合格主题
- 主题类型
- 是否需要引导

#### 2. skill\_topic\_normalize

把用户输入标准化为论文题目。

输入：原始题目\
输出：

- 标准化题目
- 解释变量
- 被解释变量
- 研究对象

#### 3. skill\_sop\_guide

生成当前研究路径说明。

输入：标准化题目\
输出：

- 当前完整 SOP
- 当前推荐开始步骤

#### 4. skill\_data\_cleaning

生成数据清洗代码与说明。

输入：变量信息 / 研究题目\
输出：

- destring
- drop missing
- log transformation
- winsorize

#### 5. skill\_data\_check

生成数据检查代码与说明。

输入：项目变量信息\
输出：

- describe
- summarize
- tab year
- xtset

#### 6. skill\_baseline\_regression

生成基准回归代码与解释。

输入：

- 因变量
- 核心解释变量
- 控制变量
- 固定效应

输出：

- 回归代码
- outreg2 导出代码
- 解释模板

#### 7. skill\_robustness

生成稳健性代码与解释。

输出只覆盖三类：

- 变量替换
- 改变样本区间
- 缩尾

#### 8. skill\_mechanism

生成机制分析代码与解释。

输出只覆盖两类：

- 中介效应
- 调节效应

#### 9. skill\_heterogeneity

生成异质性代码与解释。

输出方式：

- 基准回归 + `if` 条件分组

#### 10. skill\_iv

生成工具变量法代码与解释。

输出：

- `ivreghdfe` 代码
- 第一阶段 / 第二阶段解释逻辑

#### 11. skill\_result\_interpret

解读用户贴回来的回归结果。

重点输出：

- R² / Adjusted R²
- 核心变量方向与显著性
- 是否支持假设
- 下一步建议

#### 12. skill\_stata\_error\_debug

识别并修复常见 Stata 报错。

首版先支持：

- `command not found`
- 变量不存在
- 语法错误
- 路径错误

#### 13. skill\_export\_table

生成回归结果导出代码。

输出：

- `outreg2` 命令
- 路径修改提示
- `addtext(...)` 灵活调整提示

### 四、推荐的 Workflow 设计

建议把整个产品做成一个有限状态机（FSM）或步骤流。

#### 主流程

1. TopicDetected
2. TopicConfirmed
3. DataCleaning
4. DataChecked
5. BaselineDone
6. RobustnessDone
7. MechanismDone
8. HeterogeneityDone
9. IVDone
10. ResultExported

#### 状态切换规则

- 只有主题确认后，才能进入数据清洗
- 只有数据检查通过后，才能默认进入基准回归
- 用户也可以手动跳到某一模块，但系统要记录当前所在步骤
- 每一步完成后，都保存状态到数据库

### 五、推荐技术实现

#### 前端

- Next.js
- Tailwind CSS
- 聊天页 + 项目页 + 导出页

#### 后端

- Node.js / NestJS
- 单独的 Workflow service
- 单独的 Skill router

#### 模型层

- OpenAI API 或兼容模型 API
- 每个 Skill 对应单独 Prompt 模板

#### 数据库

- PostgreSQL
- Redis（可选，用于缓存会话状态）

#### 文件导出

- 对象存储或本地文件服务

#### 部署

- 前端：Vercel
- 后端：云服务器 / 容器服务
- 数据库：Supabase / Neon / RDS

### 六、MVP 与正式版的区别

#### MVP 版

先把 Workflow 跑通，但 Skill 可以先做成代码层函数，不一定一开始就做成复杂插件系统。

#### 正式版

再把每个模块抽象成真正独立的 Skill：

- 独立 Prompt
- 独立输入输出 schema
- 独立日志
- 独立监控

### 七、最值得优先实现的 5 个 Skill

如果你要控制开发复杂度，第一版最应该先做：

1. `skill_topic_detect`
2. `skill_topic_normalize`
3. `skill_data_cleaning`
4. `skill_baseline_regression`
5. `skill_result_interpret`

---

## 十一、推荐的部署阶段

### 阶段 1：本地原型

目标：你自己先跑通。

包含：

- 一个首页
- 一个聊天页
- 一个系统 Prompt
- 一个简单项目保存功能

### 阶段 2：灰度测试版

目标：给身边同学、朋友、经管学生测试。

包含：

- 登录
- 历史项目
- 多轮会话
- SOP 状态追踪
- 代码复制
- 导出文档

### 阶段 3：公开版

目标：任何用户都能注册使用。

包含：

- 配额管理
- 订阅付费
- 更稳定的模型路由
- 更好的错误恢复
- 项目管理页
- 管理后台
- 用户反馈入口

---

## 十二、推荐的数据结构

### 用户表 users

- id
- email
- name
- plan
- created\_at

### 项目表 projects

- id
- user\_id
- title
- topic\_raw
- topic\_normalized
- status
- current\_step
- created\_at
- updated\_at

### 对话表 messages

- id
- project\_id
- role
- content
- step
- created\_at

### 研究配置表 research\_profiles

- id
- project\_id
- dependent\_variable
- independent\_variable
- controls
- fixed\_effects
- sample\_scope
- notes

### 代码片段表 code\_blocks

- id
- project\_id
- module\_name
- language
- code
- explanation
- created\_at

### 导出表 exports

- id
- project\_id
- type
- file\_url
- created\_at

这样后续才方便做项目沉淀，而不是一轮聊天结束就丢失。

---

## 十三、前端页面建议

### 页面 1：首页

作用：引导用户输入研究主题。

模块：

- 品牌区
- 主标题
- 副标题
- 大输入框
- 示例研究主题按钮
- 历史项目入口

### 页面 2：研究聊天页

作用：主工作区。

模块：

- 左侧项目导航
- 中间聊天区
- 顶部显示当前研究主题
- 底部输入框
- 右侧可选“当前研究步骤”面板

### 页面 3：项目管理页

作用：查看历史研究项目。

模块：

- 主题
- 当前进度
- 最近更新时间
- 继续研究按钮

### 页面 4：导出页

作用：导出研究记录。

模块：

- 导出 Word
- 导出 Markdown
- 导出代码汇总
- 导出变量设计表

---

## 十四、让产品真正好用的关键交互

### 1. 不要让用户面对空白输入框

给大量可点击示例。

### 2. 不要一开始就输出很长

先确认主题，再逐步展开。

### 3. 要允许用户跳步骤

有人只想看机制，有人只想看内生性。

### 4. 要允许“用白话重讲一遍”

这对新手非常重要。

### 5. 要有“复制代码”和“复制论文解释”两个按钮

很多用户不仅想要代码，也想要文字说明。

### 6. 要能保存为项目

论文不是一次问答，而是多天、多周持续推进的过程。

### 7. 要支持 Stata 报错自动识别

这是产品体验中非常关键的一环。很多用户不是不会做回归，而是会被 Stata 报错卡住。

#### 功能定位

当用户粘贴 Stata 报错信息时，系统自动识别报错类型，并给出对应的修复建议。

#### 典型场景

用户输入：

```stata
command reghdfe not found
```

系统回复：

> 看起来你的 Stata 还没有安装 `reghdfe`，可以先运行：
>
> ```stata
> ssc install reghdfe, replace
> ssc install ftools, replace
> ```

用户输入：

```stata
command winsor2 not found
```

系统回复：

> 看起来你的 Stata 还没有安装 `winsor2`，可以先运行：
>
> ```stata
> ssc install winsor2, replace
> ```

用户输入：

```stata
command ivreghdfe not found
```

系统回复：

> 看起来你的 Stata 还没有安装 `ivreghdfe`，可以先运行：
>
> ```stata
> ssc install ivreghdfe, replace
> ```

用户输入：

```stata
command outreg2 not found
```

系统回复：

> 看起来你的 Stata 还没有安装 `outreg2`，可以先运行：
>
> ```stata
> ssc install outreg2, replace
> ```

#### 报错识别优先级

首版产品先只支持最常见的几类：

- `command ... not found`
- 变量不存在
- 语法错误
- 路径错误

#### 产品价值

这个模块会显著提升用户体验，因为它让 Agent 不只是“会写代码”，而且“能带着用户把代码跑通”。

### 8. 要支持回归结果自动解读

这是产品最核心的能力之一。

#### 功能定位

当用户把 Stata 回归结果贴给系统后，系统自动从实证论文写作角度进行解释，而不是只复述数字。

#### 系统默认重点解释三类信息

1. **R² / Adjusted R²**

   - 模型解释度如何
   - 是否属于合理区间

2. **核心解释变量的方向与显著性**

   - 系数为正还是为负
   - 是否在 1%、5%、10% 水平显著
   - 是否支持研究假设

3. **其他重要信息**

   - 样本量
   - t 值 / z 值
   - 是否控制固定效应
   - 控制变量表现是否合理

#### 标准交互话术

每次系统输出 Stata 代码后，都应主动补一句：

> 代码跑出结果了吗？把结果发给我看看，我来帮你分析。重点会看：R²、核心解释变量的显著性和方向，以及其他重要信息。

#### 输出风格要求

系统在解释结果时应同时提供：

- 白话解释
- 论文写作式解释
- 是否建议进入下一步

#### 示例解读模板

> 从结果看，模型的 R² 为 0.32，说明解释变量和控制变量共同解释了约 32% 的 ESG 变化，属于经管实证中比较常见的水平。核心解释变量 `finance_reg` 的系数为正，且在 5% 水平上显著，说明金融监管显著促进了企业 ESG 表现提升，初步支持研究假设。除此之外，还需要注意样本量是否充足，以及是否已经控制行业固定效应和年份固定效应。

### 9. 要支持回归结果导出代码

为了方便用户形成论文中的标准结果表，系统需要支持导出命令模板。

#### 推荐命令

```stata
* 如果 Stata 提示 outreg2 未安装，可以先运行：
* ssc install outreg2, replace
outreg2 using "D:\充实且快乐\paper\毕业论文\code\返稿修改V1\结果\中介.doc", replace tdec(2) bdec(3) adjr2 tstat addtext(Company FE, YES, Year FE, YES)
```

#### 命令解释

- `outreg2 using "..."`：将结果导出到指定路径
- `replace`：如果已有同名文件，则覆盖
- `tdec(2)`：t 值保留两位小数
- `bdec(3)`：系数保留三位小数
- `adjr2`：显示调整后的 R²
- `tstat`：显示 t 统计量
- `addtext(...)`：在导出的表格底部补充说明

#### 使用提示

1. `addtext(Company FE, YES, Year FE, YES)` 需要根据你实际控制的固定效应灵活调整。\
   例如：

- 如果控制了公司固定效应和年份固定效应，就可以写 `addtext(Company FE, YES, Year FE, YES)`
- 如果控制的是行业固定效应和年份固定效应，则更适合写 `addtext(Industry FE, YES, Year FE, YES)`
- 如果没有控制某类固定效应，就不要机械写 YES

2. 文件路径需要灵活调整。\
   `"D:\充实且快乐\paper\毕业论文\code\返稿修改V1\结果\中介.doc"` 只是示例路径，实际使用时要替换成你电脑中的真实路径。

3. 最后面的文件名也要灵活调整。\
   示例中的 `中介.doc` 只是文件名示例，你可以改成：

- `baseline.doc`
- `robustness.doc`
- `heterogeneity.doc`
- `iv.doc`

#### 产品交互要求

当系统输出回归代码后，除了给回归命令，还可以附带一个“导出结果表”的可选代码块，方便用户直接生成论文表格。

---

## 十五、商业化思路

### 免费版

- 主题识别
- 基准回归模板
- 每日有限次数

### 专业版

- 全 SOP
- 项目保存
- 文档导出
- 机制/异质性/内生性深度方案
- 多语言代码支持
- 长上下文项目记忆

### B 端合作

- 高校课程辅助教学
- 论文辅导机构
- 经管学院实验课程
- 学术训练营

---

## 十六、你现在最适合的落地方式

如果以你当前阶段来讲，我建议：

### 最优策略

先做一个 **MVP 网页版**，而不是一上来做成很重的平台。

### MVP 只做这些

1. 首页输入研究主题
2. 主题识别与确认
3. SOP 导航
4. 基准回归 / 稳健性 / 机制 / 异质性 / 内生性五个模块
5. 每个模块输出解释 + Stata 代码 + 代码解释
6. 项目保存

### 技术上最省事的组合

- Next.js
- Tailwind CSS
- Supabase
- OpenAI API
- Vercel

这是最容易跑通、最适合快速试错的方案。

---

## 十七、给 Codex / Cursor 的开发指令建议

后续可以直接把需求拆成以下开发任务：

### 任务 1：首页聊天式输入页

要求：

- 风格参考轻量聊天产品
- 居中大标题
- 大输入框
- 示例主题按钮
- 支持进入项目页

### 任务 2：Workflow 引擎

要求：

- 保存项目状态
- 记录当前步骤
- 控制步骤推进
- 支持用户跳步

### 任务 3：Skill Router

要求：

- 根据当前步骤调用对应 Skill
- 不同 Skill 使用独立 Prompt 模板
- 统一返回结构化输出

### 任务 4：核心 Skills 实现

第一版优先实现：

- topic\_detect
- topic\_normalize
- data\_cleaning
- baseline\_regression
- result\_interpret
- stata\_error\_debug

### 任务 5：项目管理与导出

要求：

- 保存历史项目
- 支持继续编辑
- 支持导出文档
- 支持导出回归表

---

## 十八、Skill 级别开发文档（给开发直接落地）

这一部分的目标，是把前面的产品设计再往下落一层，直接变成开发可以按模块实现的 Skill 说明。

每个 Skill 都需要明确五件事：

1. **输入是什么**
2. **输出是什么**
3. **什么时候调用**
4. **用什么 Prompt**
5. **失败了怎么办**

这样开发在实现 Skill Router 和 Workflow 时，就不会只拿到抽象概念，而是能直接写接口、写 Prompt、写异常处理。

---

### 1. skill\_topic\_detect

#### 功能

判断用户输入是不是一个合格的研究主题。

#### 输入

```json
{
  "user_input": "金融监管与企业ESG"
}
```

#### 输出

```json
{
  "is_valid_topic": true,
  "topic_type": "partial_topic",
  "needs_guidance": false,
  "reason": "用户已经提供了较明确的研究对象和变量关系，但表达不够标准化。"
}
```

#### 什么时候调用

- 用户第一次进入产品并输入内容时
- 用户修改题目时
- 用户重新开启一个项目时

#### Prompt 要点

- 判断输入是否为“可实证研究主题”
- 区分完整主题、部分主题、非主题
- 不要直接生成代码
- 如果不是完整主题，要给出引导方向

#### 失败处理

- 如果模型判断不稳定，默认按“部分主题”处理，而不是直接拒绝
- 如果输入过短，例如“ESG”，则返回 `needs_guidance = true`
- 如果输入为空，直接提示用户输入研究主题

---

### 2. skill\_topic\_normalize

#### 功能

把用户原始输入标准化成论文题目，并抽出研究骨架。

#### 输入

```json
{
  "raw_topic": "金融监管与企业ESG"
}
```

#### 输出

```json
{
  "normalized_topic": "金融监管对企业ESG的影响",
  "independent_variable": "金融监管强度",
  "dependent_variable": "企业ESG表现",
  "research_object": "A股上市公司",
  "relationship": "影响效应",
  "confirmation_message": "您要研究的主题是‘金融监管对企业ESG的影响’，对吗？"
}
```

#### 什么时候调用

- `skill_topic_detect` 判断为完整主题或部分主题后
- 用户确认进入正式研究流程前

#### Prompt 要点

- 标题要尽量标准、自然、论文化
- 自动抽出核心解释变量与被解释变量
- 没有明确研究对象时，可给出合理默认值，但要保留可修改性

#### 失败处理

- 如果无法稳定识别变量关系，则返回 2 到 3 个候选标准化题目供用户选择
- 如果研究对象不明确，不要强编过细内容，只给保守默认值

---

### 3. skill\_sop\_guide

#### 功能

在主题确认后，向用户展示完整研究路径，并引导进入第一步。

#### 输入

```json
{
  "normalized_topic": "金融监管对企业ESG的影响"
}
```

#### 输出

```json
{
  "steps": [
    "数据清洗",
    "数据检查",
    "基准回归",
    "稳健性检验",
    "机制分析",
    "异质性分析",
    "内生性检验"
  ],
  "recommended_start": "数据清洗",
  "message": "好的，主题已确认。后续我会按标准经管实证流程带您逐步完成。"
}
```

#### 什么时候调用

- 主题确认通过后立刻调用

#### Prompt 要点

- 只展示流程，不要一开始给太多代码
- 明确告诉用户：会一步一步来
- 给出推荐起点

#### 失败处理

- 如果步骤生成异常，回退到默认固定流程模板

---

### 4. skill\_data\_cleaning

#### 功能

生成数据清洗代码与解释。

#### 输入

```json
{
  "dependent_variable": "esg",
  "independent_variable": "finance_reg",
  "controls": ["size", "lev", "roa", "growth"],
  "need_log_vars": ["size"]
}
```

#### 输出

```json
{
  "module_name": "data_cleaning",
  "stata_code": "destring esg finance_reg size lev roa growth, replace force
drop if missing(esg, finance_reg, size, lev)
gen ln_size = ln(size)
winsor2 esg finance_reg size lev roa growth, replace cuts(1 99)",
  "code_explanation": [
    "destring 将字符串变量转为数值变量",
    "drop if missing 删除关键变量缺失样本",
    "gen ln_size 生成对数变量",
    "winsor2 对变量进行上下1%缩尾"
  ],
  "post_run_message": "代码跑出结果了吗？可以先把 summarize 结果发给我，我帮你看看数据是否正常。"
}
```

#### 什么时候调用

- Workflow 进入 DataCleaning 状态时

#### Prompt 要点

- 只输出基础清洗，不做过度复杂的数据工程
- 对 `winsor2` 要按需提示安装
- 对变量名要尽量使用用户上下文中的真实变量名

#### 失败处理

- 如果变量名缺失，先生成通用模板，并提示用户替换变量名
- 如果用户没有给出控制变量，先只处理核心变量

---

### 5. skill\_data\_check

#### 功能

生成数据检查代码与解释。

#### 输入

```json
{
  "panel_id": "firm_id",
  "time_var": "year",
  "key_variables": ["esg", "finance_reg", "size", "lev", "roa", "growth"]
}
```

#### 输出

```json
{
  "module_name": "data_check",
  "stata_code": "describe
summarize esg finance_reg size lev roa growth
tab year
xtset firm_id year",
  "check_items": [
    "变量是否是数值型",
    "样本量是否合理",
    "年份是否连续",
    "面板结构是否可以正常设定"
  ]
}
```

#### 什么时候调用

- DataCleaning 完成后
- 或用户主动要求检查数据结构时

#### Prompt 要点

- 聚焦最基础的数据检查
- 不要生成太长的诊断报告
- 检查后要引导进入基准回归

#### 失败处理

- 如果用户没有 firm\_id / year，删掉 `xtset`，只保留 describe / summarize / tab

---

### 6. skill\_baseline\_regression

#### 功能

生成基准回归代码、解释和结果表导出代码。

#### 输入

```json
{
  "dependent_variable": "esg",
  "independent_variable": "finance_reg",
  "controls": ["size", "lev", "roa", "growth", "board", "dual"],
  "fixed_effects": ["year", "industry"],
  "cluster_var": "firm_id"
}
```

#### 输出

```json
{
  "module_name": "baseline_regression",
  "stata_code": "reghdfe esg finance_reg size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)",
  "export_code": "outreg2 using \"D:\\results\\baseline.doc\", replace tdec(2) bdec(3) adjr2 tstat addtext(Industry FE, YES, Year FE, YES)",
  "interpretation_focus": [
    "R² / Adjusted R²",
    "核心解释变量显著性",
    "系数方向",
    "样本量和固定效应"
  ],
  "post_run_message": "代码跑出结果了吗？把结果发给我看看，我来帮你分析。重点会看：R²、核心解释变量的显著性和方向，以及其他重要信息。"
}
```

#### 什么时候调用

- Workflow 进入 Baseline 状态时
- 用户点击“开始基准回归”时

#### Prompt 要点

- 默认使用 `reghdfe`
- 对 `reghdfe` 和 `outreg2` 要按需提示安装
- `addtext(...)` 要和固定效应一致
- 路径和文件名要提醒用户灵活调整

#### 失败处理

- 如果没有固定效应信息，先输出最简版回归
- 如果没有 cluster 变量，就移除聚类设定
- 如果用户贴出 `command reghdfe not found`，转交 `skill_stata_error_debug`

---

### 7. skill\_robustness

#### 功能

生成稳健性检验代码。

#### 输入

```json
{
  "base_model": "reghdfe esg finance_reg size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)",
  "robustness_types": ["replace_variable", "change_sample", "winsorize"]
}
```

#### 输出

```json
{
  "module_name": "robustness",
  "cases": [
    {
      "name": "变量替换",
      "stata_code": "reghdfe esg_alt finance_reg size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)"
    },
    {
      "name": "改变样本区间",
      "stata_code": "reghdfe esg finance_reg size lev roa growth board dual if year>=2010, absorb(year industry) vce(cluster firm_id)"
    },
    {
      "name": "缩尾",
      "stata_code": "winsor2 esg finance_reg size lev roa growth board dual, replace cuts(1 99)
reghdfe esg finance_reg size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)"
    }
  ]
}
```

#### 什么时候调用

- BaselineDone 后
- 用户主动要求做稳健性时

#### Prompt 要点

- 只输出三类最简单稳健性
- 不展开过多高级方法

#### 失败处理

- 如果替代变量不存在，先保留模板变量名并提示用户自行替换

---

### 8. skill\_mechanism

#### 功能

生成机制分析代码。

#### 输入

```json
{
  "mode": "mediation",
  "mediator": "financing_constraint",
  "moderator": "governance_quality"
}
```

#### 输出

```json
{
  "module_name": "mechanism",
  "mediation_code": [
    "reghdfe mediator finance_reg size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)",
    "reghdfe esg finance_reg mediator size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)"
  ],
  "moderation_code": "gen interaction = finance_reg*moderator
reghdfe esg finance_reg moderator interaction size lev roa growth board dual, absorb(year industry) vce(cluster firm_id)"
}
```

#### 什么时候调用

- RobustnessDone 后
- 用户主动选择机制分析时

#### Prompt 要点

- 只覆盖中介和调节两类
- 强调机制是在解释“为什么”

#### 失败处理

- 如果用户没有给中介变量或调节变量名称，先输出 `mediator` / `moderator` 占位符模板

---

### 9. skill\_heterogeneity

#### 功能

生成异质性分析代码。

#### 输入

```json
{
  "group_var": "soe",
  "group_labels": ["soe==1", "soe==0"]
}
```

#### 输出

```json
{
  "module_name": "heterogeneity",
  "stata_code": "reghdfe esg finance_reg size lev roa growth board dual if soe==1, absorb(year industry) vce(cluster firm_id)

reghdfe esg finance_reg size lev roa growth board dual if soe==0, absorb(year industry) vce(cluster firm_id)",
  "post_run_message": "两组结果跑出来了吗？把两个回归结果都发给我看看，我来帮你比较差异。"
}
```

#### 什么时候调用

- MechanismDone 后
- 用户主动要求做分组分析时

#### Prompt 要点

- 默认使用 `if` 分组
- 不默认输出交互项式异质性

#### 失败处理

- 如果用户没有分组变量，先给 `group_var` 占位模板，并提示替换

---

### 10. skill\_iv

#### 功能

生成工具变量法代码。

#### 输入

```json
{
  "dependent_variable": "esg",
  "endogenous_variable": "finance_reg",
  "instrument_variable": "iv_variable",
  "controls": ["size", "lev", "roa", "growth", "board", "dual"],
  "fixed_effects": ["year", "industry"],
  "cluster_var": "firm_id"
}
```

#### 输出

```json
{
  "module_name": "iv",
  "stata_code": "ivreghdfe esg (finance_reg = iv_variable) size lev roa growth board dual, absorb(year industry) cluster(firm_id)",
  "post_run_message": "IV 回归结果出来了吗？把结果发给我看看，我来帮你分析。重点会看：第一阶段、第二阶段、核心解释变量的显著性和方向，以及其他重要信息。"
}
```

#### 什么时候调用

- 用户主动要求做内生性检验
- Workflow 进入 IV 阶段时

#### Prompt 要点

- 只输出工具变量法
- 强调第一阶段和第二阶段解释
- 对 `ivreghdfe` 按需提示安装

#### 失败处理

- 如果没有工具变量名称，先用 `iv_variable` 作为模板占位
- 如果用户问“这个工具变量合不合理”，转入解释模式，而不是直接生成新代码

---

### 11. skill\_result\_interpret

#### 功能

解读用户贴回来的回归结果。

#### 输入

```json
{
  "result_text": "...用户粘贴的 Stata 回归结果...",
  "current_module": "baseline_regression",
  "topic": "金融监管对企业ESG的影响"
}
```

#### 输出

```json
{
  "plain_explanation": "从结果看，核心解释变量为正且显著，初步支持研究假设。",
  "paper_style_explanation": "回归结果表明，金融监管变量的系数显著为正，说明金融监管能够显著提升企业ESG表现。",
  "analysis_points": [
    "R² / Adjusted R²",
    "核心变量显著性",
    "系数方向",
    "样本量",
    "固定效应"
  ],
  "next_suggestion": "建议继续做稳健性检验。"
}
```

#### 什么时候调用

- 用户贴出回归结果时
- 用户说“帮我看看结果”时

#### Prompt 要点

- 必须优先解释 R²、显著性、方向
- 同时给白话解释和论文式解释
- 如果结果不足以判断，要明确说缺什么信息

#### 失败处理

- 如果用户只给了截图文字不完整，先提示补充关键结果
- 如果结果里缺少 R² 或样本量，不要编造，直接说明无法判断完整模型信息

---

### 12. skill\_stata\_error\_debug

#### 功能

识别并解释 Stata 报错，给出修复建议。

#### 输入

```json
{
  "error_text": "command reghdfe not found"
}
```

#### 输出

```json
{
  "error_type": "command_not_found",
  "explanation": "你的 Stata 还没有安装 reghdfe。",
  "fix_code": "ssc install reghdfe, replace
ssc install ftools, replace",
  "retry_message": "安装后重新运行原来的代码，再把结果发给我。"
}
```

#### 什么时候调用

- 用户贴出 Stata 报错时
- 系统检测到 `command not found`、变量不存在、路径错误等关键字时

#### Prompt 要点

- 先判断错误类别，再给出最短修复建议
- 不要一上来长篇解释
- 修复后要引导用户重新运行

#### 失败处理

- 如果报错无法识别，返回“请把完整报错和对应代码一起发我”
- 不要编造不存在的 Stata 命令

---

### 13. skill\_export\_table

#### 功能

生成 outreg2 导出代码，并解释如何调整路径、文件名和 addtext。

#### 输入

```json
{
  "file_name": "baseline.doc",
  "file_path": "D:\results\baseline.doc",
  "fixed_effects": ["industry", "year"]
}
```

#### 输出

```json
{
  "stata_code": "outreg2 using \"D:\\results\\baseline.doc\", replace tdec(2) bdec(3) adjr2 tstat addtext(Industry FE, YES, Year FE, YES)",
  "notes": [
    "文件路径要替换成你电脑中的真实路径",
    "文件名可以改成 baseline.doc / robustness.doc / iv.doc",
    "addtext(...) 要根据实际控制的固定效应调整"
  ]
}
```

#### 什么时候调用

- 基准回归或其他模块代码生成后
- 用户说“帮我导出结果表”时

#### Prompt 要点

- `addtext(...)` 必须和固定效应一致
- 路径必须提醒用户修改
- 对 `outreg2` 按需提示安装

#### 失败处理

- 如果没有固定效应信息，就给出最保守的导出模板，并提示用户自行修改 `addtext(...)`

---

### Skill Router 的实现建议

后端在实现 Skill Router 时，可以统一采用这样的调用格式：

```json
{
  "skill_name": "baseline_regression",
  "project_id": "xxx",
  "step": "Baseline",
  "payload": {
    "dependent_variable": "esg",
    "independent_variable": "finance_reg",
    "controls": ["size", "lev", "roa"]
  }
}
```

统一返回格式建议为：

```json
{
  "success": true,
  "skill_name": "baseline_regression",
  "data": {},
  "error": null
}
```

如果失败：

```json
{
  "success": false,
  "skill_name": "baseline_regression",
  "data": null,
  "error": {
    "type": "missing_variable_info",
    "message": "缺少控制变量信息，已回退到最简模板。"
  }
}
```

这样整个 Workflow / Skills 系统会更容易调试、监控和扩展。

---

## 十九、Skill Prompt 模板（开发可直接接入）

这一部分用于把每个 Skill 再进一步落地为可直接放进代码中的 Prompt 模板。建议后端将这些 Prompt 按 Skill 分文件管理，并配合统一的输入 schema 使用。

---

### 1. topic\_detect Prompt

#### 作用

判断用户输入是不是合格的研究主题。

#### Prompt 模板

```text
你是一个经管实证论文选题识别助手。

你的任务是判断用户输入是否属于“可实证研究主题”。

判断标准：
1. 完整主题：包含较明确的解释变量和被解释变量，通常是“X 对 Y 的影响”
2. 部分主题：已经涉及研究方向和变量关系，但表达不够完整或不够标准
3. 非主题：只是领域、情绪表达、泛泛提问或代码请求

请严格输出 JSON：
{
  "is_valid_topic": true,
  "topic_type": "full_topic | partial_topic | not_topic",
  "needs_guidance": false,
  "reason": "简要解释判断原因"
}

用户输入：{{user_input}}
```

---

### 2. topic\_normalize Prompt

#### 作用

把用户原始输入标准化成论文题目，并抽出研究骨架。

#### Prompt 模板

```text
你是一个经管实证论文题目标准化助手。

请将用户输入改写成自然、标准、适合论文使用的研究题目，并抽取研究骨架。

请严格输出 JSON：
{
  "normalized_topic": "标准化题目",
  "independent_variable": "解释变量",
  "dependent_variable": "被解释变量",
  "research_object": "研究对象",
  "relationship": "影响效应 / 相关关系 / 机制关系",
  "confirmation_message": "用于向用户确认题目的话术"
}

要求：
1. 标题要自然，不要机械堆词
2. 如果研究对象不明确，可以给出保守默认值
3. 不要生成代码

用户输入：{{raw_topic}}
```

---

### 3. sop\_guide Prompt

#### 作用

展示研究流程并引导用户进入第一步。

#### Prompt 模板

```text
你是一个经管实证研究流程助手。

给定用户已经确认的研究题目，请输出标准研究路径，并告诉用户下一步从哪里开始。

请严格输出 JSON：
{
  "steps": ["数据清洗", "数据检查", "基准回归", "稳健性检验", "机制分析", "异质性分析", "内生性检验"],
  "recommended_start": "数据清洗",
  "message": "面向用户的引导话术"
}

研究题目：{{normalized_topic}}
```

---

### 4. data\_cleaning Prompt

#### 作用

生成数据清洗代码。

#### Prompt 模板

```text
你是一个经管实证数据清洗助手。

请根据给定变量生成基础 Stata 数据清洗代码，只包含以下内容：
1. destring
2. 删除关键变量缺失值
3. 生成常见对数变量
4. winsorize 上下1%

请严格输出 JSON：
{
  "module_name": "data_cleaning",
  "stata_code": "完整 Stata 代码",
  "code_explanation": ["逐条解释"],
  "post_run_message": "让用户运行后反馈结果的话术"
}

要求：
- 只输出基础清洗，不做复杂特征工程
- 若涉及 winsor2，需按需提示安装
- 优先使用用户提供的真实变量名

输入变量：{{payload}}
```

---

### 5. data\_check Prompt

#### 作用

生成数据检查代码。

#### Prompt 模板

```text
你是一个经管实证数据检查助手。

请根据给定变量，生成最基础的 Stata 数据检查代码，包含：
1. describe
2. summarize
3. tab year
4. xtset（如果 panel_id 和 time_var 存在）

请严格输出 JSON：
{
  "module_name": "data_check",
  "stata_code": "完整 Stata 代码",
  "check_items": ["需要用户重点检查的项目"]
}

要求：
- 不要输出长篇报告
- 检查后默认引导进入基准回归
- 如果 panel 信息缺失，不要强行输出 xtset

输入变量：{{payload}}
```

---

### 6. baseline\_regression Prompt

#### 作用

生成基准回归代码和结果导出代码。

#### Prompt 模板

```text
你是一个经管实证基准回归助手。

请根据给定变量生成基准回归的 Stata 代码，并同时生成 outreg2 导出代码。

请严格输出 JSON：
{
  "module_name": "baseline_regression",
  "stata_code": "回归代码",
  "export_code": "导出表格代码",
  "interpretation_focus": ["R² / Adjusted R²", "核心解释变量显著性", "系数方向", "样本量和固定效应"],
  "post_run_message": "运行后反馈结果的话术"
}

要求：
- 默认使用 reghdfe
- 若涉及 reghdfe 或 outreg2，需按需提示安装
- addtext(...) 要与固定效应一致
- 路径和文件名要提醒用户灵活调整

输入变量：{{payload}}
```

---

### 7. robustness Prompt

#### 作用

生成稳健性检验代码。

#### Prompt 模板

```text
你是一个经管实证稳健性检验助手。

请只输出三种最基础的稳健性检验：
1. 变量替换
2. 改变样本区间
3. 缩尾处理

请严格输出 JSON：
{
  "module_name": "robustness",
  "cases": [
    {"name": "变量替换", "stata_code": "..."},
    {"name": "改变样本区间", "stata_code": "..."},
    {"name": "缩尾", "stata_code": "..."}
  ]
}

要求：
- 不要展开高级方法
- 如果变量缺失，可保留占位符模板

输入变量：{{payload}}
```

---

### 8. mechanism Prompt

#### 作用

生成机制分析代码。

#### Prompt 模板

```text
你是一个经管实证机制分析助手。

请只生成两类机制分析代码：
1. 中介效应
2. 调节效应

请严格输出 JSON：
{
  "module_name": "mechanism",
  "mediation_code": ["...", "..."],
  "moderation_code": "..."
}

要求：
- 机制分析的目标是解释“为什么”
- 如果中介变量或调节变量缺失，可以保留 mediator / moderator 占位符

输入变量：{{payload}}
```

---

### 9. heterogeneity Prompt

#### 作用

生成异质性分析代码。

#### Prompt 模板

```text
你是一个经管实证异质性分析助手。

请基于用户已有的基准回归，使用 if 条件分组方式生成异质性分析代码。

请严格输出 JSON：
{
  "module_name": "heterogeneity",
  "stata_code": "完整分组回归代码",
  "post_run_message": "运行后反馈结果的话术"
}

要求：
- 默认使用 if 分组
- 不默认输出交互项模型
- 如果没有分组变量，用 group_var 占位并提示替换

输入变量：{{payload}}
```

---

### 10. iv Prompt

#### 作用

生成工具变量法代码。

#### Prompt 模板

```text
你是一个经管实证内生性检验助手。

请只输出工具变量法（IV）的 Stata 代码。

请严格输出 JSON：
{
  "module_name": "iv",
  "stata_code": "ivreghdfe 代码",
  "post_run_message": "运行后反馈结果的话术"
}

要求：
- 只讲工具变量法
- 强调第一阶段和第二阶段
- 如果没有工具变量名称，用 iv_variable 占位
- 若涉及 ivreghdfe，需按需提示安装

输入变量：{{payload}}
```

---

### 11. result\_interpret Prompt

#### 作用

解读用户贴回来的回归结果。

#### Prompt 模板

```text
你是一个经管实证回归结果解读助手。

请根据用户提供的回归结果，从论文写作角度进行解释。

必须优先解释：
1. R² / Adjusted R²
2. 核心解释变量的显著性
3. 系数方向
4. 是否支持研究假设
5. 样本量和固定效应（如果结果中出现）

请严格输出 JSON：
{
  "plain_explanation": "白话解释",
  "paper_style_explanation": "论文式解释",
  "analysis_points": ["R² / Adjusted R²", "核心变量显著性", "系数方向", "样本量", "固定效应"],
  "next_suggestion": "建议下一步"
}

要求：
- 不能编造结果中不存在的信息
- 如果结果不完整，要明确说明缺什么

输入结果：{{result_text}}
研究主题：{{topic}}
当前模块：{{current_module}}
```

---

### 12. stata\_error\_debug Prompt

#### 作用

识别并修复 Stata 报错。

#### Prompt 模板

```text
你是一个 Stata 报错修复助手。

请识别用户给出的报错，并返回最短、最可执行的修复建议。

优先识别：
- command not found
- 变量不存在
- 语法错误
- 路径错误

请严格输出 JSON：
{
  "error_type": "错误类型",
  "explanation": "一句话解释",
  "fix_code": "修复代码，如果没有则为 null",
  "retry_message": "修复后如何继续"
}

要求：
- 不要长篇解释
- 不要编造 Stata 命令
- 如果无法识别，要求用户补充完整报错和代码

错误信息：{{error_text}}
```

---

### 13. export\_table Prompt

#### 作用

生成 outreg2 导出代码。

#### Prompt 模板

```text
你是一个经管实证结果表导出助手。

请根据给定文件路径、文件名和固定效应，生成 outreg2 导出代码。

请严格输出 JSON：
{
  "stata_code": "outreg2 代码",
  "notes": [
    "路径需要替换成真实路径",
    "文件名可以灵活调整",
    "addtext(...) 要与固定效应一致"
  ]
}

要求：
- addtext(...) 必须根据 fixed_effects 自动匹配
- 如果 fixed_effects 不完整，就输出最保守模板
- 若涉及 outreg2，需按需提示安装

输入变量：{{payload}}
```

---

## 二十、后端接口设计（MVP 可直接实现）

这一部分用于把 Workflow / Skills 方案落成真正的后端 API。

建议采用：

- `POST /api/projects` 创建项目
- `GET /api/projects/:id` 获取项目
- `POST /api/workflow/next` 推进步骤
- `POST /api/skills/:skillName` 单独调用某个 skill

---

### 1. 创建项目

**POST /api/projects**

#### 请求体

```json
{
  "user_id": "u_001",
  "topic_raw": "金融监管与企业ESG"
}
```

#### 返回体

```json
{
  "success": true,
  "project": {
    "id": "p_001",
    "topic_raw": "金融监管与企业ESG",
    "current_step": "TopicDetected",
    "status": "active"
  }
}
```

---

### 2. 获取项目详情

**GET /api/projects/****:id**

#### 返回体

```json
{
  "success": true,
  "project": {
    "id": "p_001",
    "topic_raw": "金融监管与企业ESG",
    "topic_normalized": "金融监管对企业ESG的影响",
    "current_step": "Baseline",
    "status": "active"
  },
  "messages": [],
  "research_profile": {}
}
```

---

### 3. 调用单个 Skill

**POST /api/skills/****:skillName**

例如：

- `/api/skills/topic-detect`
- `/api/skills/topic-normalize`
- `/api/skills/data-cleaning`
- `/api/skills/baseline-regression`
- `/api/skills/result-interpret`

#### 通用请求体

```json
{
  "project_id": "p_001",
  "payload": {}
}
```

#### 通用返回体

```json
{
  "success": true,
  "skill_name": "baseline_regression",
  "data": {},
  "error": null
}
```

#### 失败返回体

```json
{
  "success": false,
  "skill_name": "baseline_regression",
  "data": null,
  "error": {
    "type": "missing_variable_info",
    "message": "缺少控制变量信息，已回退到最简模板。"
  }
}
```

---

### 4. Workflow 推进接口

**POST /api/workflow/next**

这个接口的作用是： 根据项目当前状态、用户新输入、以及必要的技能调用结果，自动推进到下一步。

#### 请求体

```json
{
  "project_id": "p_001",
  "user_message": "是的，开始基准回归吧"
}
```

#### 返回体

```json
{
  "success": true,
  "current_step": "Baseline",
  "next_action": "call_skill",
  "skill_name": "baseline_regression",
  "payload": {
    "dependent_variable": "esg",
    "independent_variable": "finance_reg",
    "controls": ["size", "lev", "roa"]
  }
}
```

---

### 5. 保存消息接口

**POST /api/messages**

#### 请求体

```json
{
  "project_id": "p_001",
  "role": "user",
  "content": "金融监管与企业ESG",
  "step": "TopicDetected"
}
```

#### 说明

- 每轮对话都建议写入 messages 表
- 后续可用于恢复会话、查看历史记录、生成导出文档

---

### 6. 保存研究配置接口

**POST /api/research-profile**

#### 请求体

```json
{
  "project_id": "p_001",
  "dependent_variable": "esg",
  "independent_variable": "finance_reg",
  "controls": ["size", "lev", "roa", "growth"],
  "fixed_effects": ["year", "industry"],
  "cluster_var": "firm_id"
}
```

#### 说明

- 这一层相当于项目的结构化研究设定
- 后续所有 skill 都尽量从这里取变量，而不是每次让用户重新说一遍

---

### 7. 导出结果接口

**POST /api/exports**

#### 请求体

```json
{
  "project_id": "p_001",
  "type": "docx"
}
```

#### 返回体

```json
{
  "success": true,
  "file_url": "https://.../exports/p_001.docx"
}
```

---

### 8. Skill Router 后端建议

后端建议做一个统一 Skill Router，逻辑如下：

1. 根据 `skillName` 找到对应 Prompt 模板
2. 校验 payload 是否满足 schema
3. 调用模型
4. 校验模型返回是否满足 JSON schema
5. 若失败则走 fallback
6. 成功后写入 logs / messages / code\_blocks

#### 推荐目录结构

```text
/backend
  /api
  /workflow
  /skills
    topicDetect.ts
    topicNormalize.ts
    sopGuide.ts
    dataCleaning.ts
    dataCheck.ts
    baselineRegression.ts
    robustness.ts
    mechanism.ts
    heterogeneity.ts
    iv.ts
    resultInterpret.ts
    stataErrorDebug.ts
    exportTable.ts
  /prompts
    topicDetect.txt
    topicNormalize.txt
    sopGuide.txt
    dataCleaning.txt
    dataCheck.txt
    baselineRegression.txt
    robustness.txt
    mechanism.txt
    heterogeneity.txt
    iv.txt
    resultInterpret.txt
    stataErrorDebug.txt
    exportTable.txt
```

---

## 二十一、核心 Agent Prompt（开发直接可用）

下面是一份可以直接用于实现该 Agent 的核心系统 Prompt 示例。

### System Prompt

你是一个经管实证研究助手，运行在 Workflow / Skills 架构中，任务是帮助用户一步一步完成实证论文的研究流程。

必须遵守以下规则：

1. **先识别研究主题**

   - 如果用户输入不是研究主题，需要引导用户补充。
   - 一个合格主题通常是“X 对 Y 的影响”。

2. **确认研究主题**

   - 将用户输入标准化为论文题目。
   - 与用户确认后才进入下一步。

3. **按照固定 Workflow 推进研究** 顺序为：

   - 数据清洗
   - 数据检查
   - 基准回归
   - 稳健性检验
   - 机制分析
   - 异质性分析
   - 内生性检验

4. **当前步骤必须匹配对应 Skill 输出**

   - 主题识别阶段调用 topic\_detect
   - 主题确认阶段调用 topic\_normalize
   - 数据清洗阶段调用 data\_cleaning
   - 数据检查阶段调用 data\_check
   - 基准回归阶段调用 baseline\_regression
   - 稳健性阶段调用 robustness
   - 机制阶段调用 mechanism
   - 异质性阶段调用 heterogeneity
   - IV 阶段调用 iv
   - 结果解读阶段调用 result\_interpret
   - 报错修复阶段调用 stata\_error\_debug

5. **每个模块必须输出以下内容**

   - 这一步的目的
   - 在当前研究主题下的含义
   - 变量与模型设计
   - Stata 示例代码
   - 代码解释

6. **代码输出后必须询问用户是否跑出结果**

标准话术：

> 代码跑出结果了吗？把结果发给我看看，我来帮你分析。重点会看：R²、核心解释变量的显著性和方向，以及其他重要信息。

7. **优先处理 Stata 报错** 如果用户贴出报错，需要暂停当前步骤，优先调用报错修复 Skill。

8. **结果解读必须聚焦三类信息**

   - R² / Adjusted R²
   - 核心变量显著性
   - 系数方向与假设是否成立

---

## 二十二、用户流程（产品视角）

为了让开发更清楚产品如何运行，可以把整个用户路径简化为五步：

### 第一步：输入研究主题

用户进入首页，只需要输入一句话，例如：

- 金融监管对企业 ESG 的影响

系统进行主题识别。

---

### 第二步：主题确认

系统标准化题目，例如：

> 您要研究的主题是“金融监管对企业 ESG 的影响”，对吗？

用户确认后进入研究流程。

---

### 第三步：展示研究路线

系统展示 SOP：

基准回归 → 稳健性 → 机制 → 异质性 → 内生性

用户点击 **开始数据清洗**，然后按步骤进入数据检查和基准回归。

---

### 第四步：逐步完成实证分析

每一步都会：

- 解释该步骤
- 给出 Stata 代码
- 让用户运行代码
- 帮用户解释回归结果

---

### 第五步：生成论文结果表

用户可以使用系统给出的 `outreg2` 命令导出论文表格。

---

## 二十三、结论

这个方向完全成立，而且很有产品化潜力。

它最强的点不在于“能聊天”，而在于它把经管实证论文这件原本门槛很高、很碎、很依赖老师和学长学姐口口相传的事情，重新包装成了一个可交互、可引导、可复制、可规模化的产品流程。

对个人用户，它是论文研究助手。 对教学场景，它是方法训练工具。 对产品层面，它是一个垂直且非常具体的 AI Agent 场景。

下一步最值得做的是：

**继续把这份 PRD 往下细化成可以直接交给 Codex 的开发文档，包括页面结构、Prompt 设计、数据库字段、前后端交互和 MVP 开发清单。**

