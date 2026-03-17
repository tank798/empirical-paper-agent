import {
  AssistantMessageType,
  ExportWriteMode,
  ProjectStepStatus,
  WorkflowStep,
  type ProjectDetail
} from "@empirical/shared";

export const workflowStepMeta: Record<
  WorkflowStep,
  {
    label: string;
    short: string;
    description: string;
    phase: "mvp" | "future";
  }
> = {
  TOPIC_DETECT: {
    label: "研究主题识别",
    short: "选题识别",
    description: "判断输入是否是一个可进入实证研究流程的题目。",
    phase: "mvp"
  },
  TOPIC_NORMALIZE: {
    label: "主题标准化确认",
    short: "主题确认",
    description: "把研究主题整理成论文式表述，并抽出核心变量骨架。",
    phase: "mvp"
  },
  SOP_GUIDE: {
    label: "研究路径",
    short: "研究路径",
    description: "给出当前题目的推荐推进路径和下一步动作。",
    phase: "mvp"
  },
  DATA_CLEANING: {
    label: "数据清洗",
    short: "数据清洗",
    description: "生成清洗、缺失值处理和极值处理的基础 Stata 代码。",
    phase: "mvp"
  },
  DATA_CHECK: {
    label: "数据检查",
    short: "数据检查",
    description: "检查变量类型、描述统计、时间分布和面板结构。",
    phase: "mvp"
  },
  BASELINE_REGRESSION: {
    label: "基准回归",
    short: "基准回归",
    description: "生成基准回归命令和 outreg2 导出命令。",
    phase: "mvp"
  },
  ROBUSTNESS: {
    label: "稳健性检验",
    short: "稳健性",
    description: "替换变量、缩尾样本和替代模型等稳健性方案。",
    phase: "future"
  },
  MECHANISM: {
    label: "机制分析",
    short: "机制分析",
    description: "围绕中介渠道或作用路径展开扩展分析。",
    phase: "future"
  },
  HETEROGENEITY: {
    label: "异质性分析",
    short: "异质性",
    description: "从样本分组或交互项角度识别差异化效应。",
    phase: "future"
  },
  IV: {
    label: "内生性检验（IV）",
    short: "IV 检验",
    description: "构造工具变量并执行两阶段回归。",
    phase: "future"
  },
  EXPORT_TABLE: {
    label: "回归表导出",
    short: "导出回归表",
    description: "导出论文表格、研究记录和 Stata 代码清单。",
    phase: "future"
  }
};

export const stepStatusMeta: Record<
  ProjectStepStatus,
  {
    label: string;
    tone: string;
  }
> = {
  PENDING: {
    label: "待开始",
    tone: "bg-slate-100 text-slate-600"
  },
  IN_PROGRESS: {
    label: "进行中",
    tone: "bg-amber-100 text-amber-900"
  },
  COMPLETED: {
    label: "已完成",
    tone: "bg-emerald-100 text-emerald-800"
  },
  SKIPPED: {
    label: "已跳过",
    tone: "bg-slate-200 text-slate-700"
  },
  BLOCKED: {
    label: "已阻塞",
    tone: "bg-rose-100 text-rose-800"
  }
};

export const messageTypeMeta: Record<
  AssistantMessageType,
  {
    label: string;
    tone: string;
  }
> = {
  topic_confirm: {
    label: "主题确认",
    tone: "text-rust"
  },
  sop_guide: {
    label: "研究路径",
    tone: "text-emerald-700"
  },
  skill_output: {
    label: "技能输出",
    tone: "text-slate-700"
  },
  research_chat: {
    label: "研究问答",
    tone: "text-cyan-700"
  },
  result_interpret: {
    label: "结果解读",
    tone: "text-indigo-700"
  },
  stata_error_fix: {
    label: "Stata 修复",
    tone: "text-rose-700"
  },
  system_notice: {
    label: "系统提示",
    tone: "text-amber-800"
  }
};

export const moduleLabelMap: Record<string, string> = {
  topic_detect: "研究主题识别",
  topic_normalize: "主题标准化",
  sop_guide: "研究路径",
  data_cleaning: "数据清洗",
  data_check: "数据检查",
  baseline_regression: "基准回归",
  robustness: "稳健性检验",
  mechanism: "机制分析",
  heterogeneity: "异质性分析",
  iv: "内生性检验（IV）",
  general_research_chat: "研究问答",
  export_table: "回归表导出"
};

export const quickActionMap: Partial<Record<WorkflowStep, Array<{ label: string; value: string }>>> = {
  SOP_GUIDE: [{ label: "进入数据清洗", value: "继续进入数据清洗" }],
  DATA_CLEANING: [
    { label: "进入数据检查", value: "继续进入数据检查" },
    { label: "补充清洗代码", value: "请补充一版更详细的数据清洗代码" }
  ],
  DATA_CHECK: [
    { label: "进入基准回归", value: "开始基准回归" },
    { label: "补充检查项", value: "请补充数据检查说明" }
  ],
  BASELINE_REGRESSION: [
    {
      label: "解释回归结果",
      value: "Number of obs = 15234; coef. digital_finance = 0.084***; t = 3.25; Adj R2 = 0.312"
    },
    { label: "排查 Stata 报错", value: "这是我的 Stata 报错：command reghdfe not found" }
  ]
};

export const exportCards = [
  {
    type: "docx",
    title: "论文回归表（Word）",
    description: "导出当前项目的表格版回归结果，后续支持 docx 模板。"
  },
  {
    type: "markdown",
    title: "研究记录（Markdown）",
    description: "导出步骤记录、研究设定和关键说明，便于归档与协作。"
  },
  {
    type: "stata_bundle",
    title: "Stata 代码包",
    description: "导出清洗、检查、回归和修复代码的分模块清单。"
  },
  {
    type: "variable_notes",
    title: "变量设计说明",
    description: "导出变量口径、控制变量和固定效应设定说明。"
  }
] as const;

export function formatDateTime(value?: string | null) {
  if (!value) {
    return "待更新";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatWriteMode(mode?: ExportWriteMode | null) {
  if (mode === ExportWriteMode.REPLACE) {
    return "首次写入（replace）";
  }

  if (mode === ExportWriteMode.APPEND) {
    return "继续追加（append）";
  }

  return "待生成";
}

export function getStepProgress(steps: ProjectDetail["steps"] | undefined) {
  if (!steps?.length) {
    return { completed: 0, total: 0, percent: 0 };
  }

  const total = steps.filter((item) => workflowStepMeta[item.step].phase === "mvp").length;
  const completed = steps.filter(
    (item) => workflowStepMeta[item.step].phase === "mvp" && item.status === "COMPLETED"
  ).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return { completed, total, percent };
}

export function getFutureSteps(steps: ProjectDetail["steps"] | undefined) {
  return (steps ?? []).filter((step) => workflowStepMeta[step.step].phase === "future");
}
