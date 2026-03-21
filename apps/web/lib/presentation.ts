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
    label: "研究设定整理",
    short: "设定整理",
    description: "识别用户输入中的研究设定信息，并整理出结构化研究摘要。",
    phase: "mvp"
  },
  TOPIC_NORMALIZE: {
    label: "研究设定确认",
    short: "设定确认",
    description: "确认研究主题、研究对象、变量、控制变量、样本区间和固定效应。",
    phase: "mvp"
  },
  SOP_GUIDE: {
    label: "研究路径",
    short: "研究路径",
    description: "生成整套 Stata 工作流之前的研究路径与模块安排。",
    phase: "mvp"
  },
  DATA_CLEANING: {
    label: "数据处理",
    short: "数据处理",
    description: "生成数据清洗、缺失值处理和异常值处理建议。",
    phase: "mvp"
  },
  DATA_CHECK: {
    label: "数据检查",
    short: "数据检查",
    description: "检查样本结构、描述统计与面板设定。",
    phase: "mvp"
  },
  BASELINE_REGRESSION: {
    label: "基准回归",
    short: "基准回归",
    description: "生成基准回归代码和结果导出命令。",
    phase: "mvp"
  },
  ROBUSTNESS: {
    label: "稳健性检验",
    short: "稳健性检验",
    description: "围绕替代口径、替代样本和替代设定做稳健性检验。",
    phase: "mvp"
  },
  MECHANISM: {
    label: "机制分析",
    short: "机制分析",
    description: "围绕中介渠道或作用路径展开机制分析。",
    phase: "mvp"
  },
  HETEROGENEITY: {
    label: "异质性分析",
    short: "异质性分析",
    description: "识别不同样本组中的差异化效应。",
    phase: "mvp"
  },
  IV: {
    label: "内生性分析",
    short: "内生性分析",
    description: "构造工具变量并执行两阶段回归。",
    phase: "mvp"
  },
  EXPORT_TABLE: {
    label: "回归表导出",
    short: "回归表导出",
    description: "导出论文表格、研究记录和代码清单。",
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
    label: "研究设定",
    tone: "text-slate-700"
  },
  sop_guide: {
    label: "研究路径",
    tone: "text-emerald-700"
  },
  skill_output: {
    label: "模块结果",
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
  topic_detect: "研究设定整理",
  topic_normalize: "研究设定确认",
  sop_guide: "研究路径",
  data_cleaning: "数据处理",
  data_check: "数据检查",
  baseline_regression: "基准回归",
  robustness: "稳健性检验",
  mechanism: "机制分析",
  heterogeneity: "异质性分析",
  iv: "内生性分析",
  general_research_chat: "研究问答",
  export_table: "回归表导出"
};

export const quickActionMap: Partial<Record<WorkflowStep, Array<{ label: string; value: string }>>> = {
  DATA_CLEANING: [
    { label: "继续看数据检查", value: "继续查看数据检查" },
    { label: "补充数据清洗代码", value: "请补充一版更详细的数据清洗代码" }
  ],
  DATA_CHECK: [
    { label: "继续看基准回归", value: "继续查看基准回归" },
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
    description: "导出当前项目的论文表格版回归结果。"
  },
  {
    type: "markdown",
    title: "研究记录（Markdown）",
    description: "导出研究设定、过程记录和关键说明。"
  },
  {
    type: "stata_bundle",
    title: "Stata 代码包",
    description: "导出数据处理、回归与扩展检验代码清单。"
  },
  {
    type: "variable_notes",
    title: "变量说明",
    description: "导出变量口径、控制变量和固定效应说明。"
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
