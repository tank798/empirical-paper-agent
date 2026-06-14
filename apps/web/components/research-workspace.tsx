"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import {
  WorkflowStep,
  WorkflowStreamPhase,
  type AgentRunSummary,
  type AssistantMessageEnvelope,
  type DataDictionaryEntry,
  type ProjectDetail,
  type ResearchProfile,
  type TermMapping,
  type WorkflowNextResponse,
  type WorkflowProgressPayload,
  type WorkflowStreamPhase as WorkflowStreamPhaseValue
} from "@empirical/shared";
import {
  SUPPORTED_ATTACHMENT_ACCEPT,
  buildComposerSubmission,
  buildPendingImageAttachment,
  readComposerAttachment,
  readImageAttachment,
  type ComposerAttachment
} from "../lib/attachments";
import { apiRequest, streamApiRequest } from "../lib/api";
import { ensureNamedImageFile } from "../lib/image-ocr";
import { appendCommittedSpeech, buildSpeechText, finalizeSpeechText, inferSpeechRecognitionLanguage } from "../lib/speech";
import { normalizeAssistantCopy, normalizeDisplayText, normalizeResearchObjectText } from "../lib/message-display";
import { clearPendingProjectBootstrap, getPendingProjectBootstrap, getStoredProject, getStoredProjects } from "../lib/storage";
import { ChatComposer } from "./chat-composer";
import { FormattedText } from "./formatted-text";
import { StataCodeBlock } from "./stata-code-block";
import { ThinkingBubble } from "./thinking-bubble";
import { TypingDots } from "./typing-dots";

type StageDefinition = {
  id: "topic" | "data" | "baseline" | "robustness" | "iv" | "mechanism" | "heterogeneity";
  label: string;
  steps: WorkflowStep[];
};

type StageId = StageDefinition["id"];

type LiveTurnState = {
  id: string;
  userMessage: AssistantMessageEnvelope;
  assistantMessage: AssistantMessageEnvelope | null;
  phase: WorkflowStreamPhaseValue;
  statusText: string;
  streamingText: string;
  error: string | null;
};

type AssistantPanelMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: "loading" | "streaming" | "done" | "error" | "stopped";
};

type AccordionKey = "goal" | "stataCode" | "codeExplanation" | "readingAdvice";

type AccordionState = Record<AccordionKey, boolean>;

type StageSectionContent = {
  goal: ReactNode;
  stataCode: ReactNode;
  codeExplanation: ReactNode;
  readingAdvice: ReactNode;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  isFinal?: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

const WORKFLOW_STAGES: StageDefinition[] = [
  { id: "topic", label: "主题确认", steps: [WorkflowStep.TOPIC_DETECT, WorkflowStep.TOPIC_NORMALIZE] },
  { id: "data", label: "路径与数据", steps: [WorkflowStep.SOP_GUIDE, WorkflowStep.DATA_CLEANING, WorkflowStep.DATA_CHECK] },
  { id: "baseline", label: "基准回归", steps: [WorkflowStep.BASELINE_REGRESSION] },
  { id: "robustness", label: "稳健性检验", steps: [WorkflowStep.ROBUSTNESS] },
  { id: "iv", label: "内生性分析", steps: [WorkflowStep.IV] },
  { id: "mechanism", label: "机制分析", steps: [WorkflowStep.MECHANISM] },
  { id: "heterogeneity", label: "异质性分析", steps: [WorkflowStep.HETEROGENEITY] }
];

const DEFAULT_ACCORDION_STATE: AccordionState = {
  goal: true,
  stataCode: true,
  codeExplanation: false,
  readingAdvice: false
};

const TERM_CATEGORY_LABELS: Record<TermMapping["category"], string> = {
  independent: "解释变量",
  dependent: "被解释变量",
  control: "控制变量",
  fixed_effect: "固定效应",
  cluster: "聚类变量",
  panel: "面板 id",
  time: "时间变量"
};

const MODULE_GOAL_ITEMS: Partial<Record<StageId, string[]>> = {
  baseline: [
    "建立论文的主模型，先回答“解释变量是否会影响被解释变量”这个核心问题。",
    "通过基准回归得到最基础的方向、系数大小和显著性结果，作为后续所有检验的参照。",
    "后续稳健性检验、内生性分析、机制分析和异质性分析都应围绕这一基准结果展开。"
  ],
  robustness: [
    "基准回归得到的结论可能受到变量口径、样本选择、模型设定或偶然样本波动影响。",
    "稳健性检验的目的，是用多种替代设定反复验证核心结论是否仍然成立。",
    "如果换变量、换样本、换模型后结果方向和显著性仍较稳定，就能从统计上增强结论的可信度。"
  ],
  iv: [
    "即使基准回归显著，也不能直接说明因果关系，因为可能存在反向因果、遗漏变量或选择偏误。",
    "内生性分析的目的，是检查“解释变量影响被解释变量”这个结论是否可能被其他未观察因素干扰。",
    "如果用户提供了真实工具变量或可用识别策略，本节应生成对应处理方案；如果没有，不编造工具变量，只提示需要补充。"
  ],
  mechanism: [
    "基准回归只能说明 A 与 B 之间存在关系，但还不能解释 A 为什么、通过什么路径影响 B。",
    "机制分析的目的，是进一步检验 A 是否通过某些中间变量或传导渠道对 B 产生影响。",
    "如果用户提供了机制变量，本节应围绕这些机制变量设计检验；如果没有，可以提示用户后续补充可能的机制路径。"
  ],
  heterogeneity: [
    "同一个影响关系在不同类型样本中可能并不一样，例如不同地区、行业、产权性质或企业规模下效果可能不同。",
    "异质性分析的目的，是比较不同分组中核心关系是否存在差异，帮助解释结论适用于哪些场景。",
    "如果用户提供了分组变量，本节按该变量展开；如果没有，可以提示用户补充行业、地区、产权性质、企业规模等常见分组维度。"
  ]
};

const STAGE_ID_BY_STEP: Record<WorkflowStep, StageId> = {
  [WorkflowStep.TOPIC_DETECT]: "topic",
  [WorkflowStep.TOPIC_NORMALIZE]: "topic",
  [WorkflowStep.SOP_GUIDE]: "data",
  [WorkflowStep.DATA_CLEANING]: "data",
  [WorkflowStep.DATA_CHECK]: "data",
  [WorkflowStep.BASELINE_REGRESSION]: "baseline",
  [WorkflowStep.ROBUSTNESS]: "robustness",
  [WorkflowStep.MECHANISM]: "mechanism",
  [WorkflowStep.HETEROGENEITY]: "heterogeneity",
  [WorkflowStep.IV]: "iv",
  [WorkflowStep.EXPORT_TABLE]: "baseline"
};

const STAGE_ID_BY_PROGRESS_LABEL: Partial<Record<string, StageId>> = {
  "\u7814\u7a76\u8bbe\u5b9a": "topic",
  "\u7814\u7a76\u8def\u5f84": "data",
  "\u6570\u636e\u5904\u7406": "data",
  "\u6570\u636e\u68c0\u67e5": "data",
  "\u57fa\u51c6\u56de\u5f52": "baseline",
  "\u7a33\u5065\u6027\u68c0\u9a8c": "robustness",
  "\u5185\u751f\u6027\u5206\u6790": "iv",
  "\u673a\u5236\u5206\u6790": "mechanism",
  "\u5f02\u8d28\u6027\u5206\u6790": "heterogeneity"
};

const REQUESTED_STEP_BY_STAGE: Record<StageId, WorkflowStep> = {
  topic: WorkflowStep.TOPIC_NORMALIZE,
  data: WorkflowStep.DATA_CLEANING,
  baseline: WorkflowStep.BASELINE_REGRESSION,
  robustness: WorkflowStep.ROBUSTNESS,
  iv: WorkflowStep.IV,
  mechanism: WorkflowStep.MECHANISM,
  heterogeneity: WorkflowStep.HETEROGENEITY
};

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function isAbortError(value: unknown) {
  return value instanceof DOMException && value.name === "AbortError";
}

function listValue(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

function createLocalUserMessage(message: string, step: WorkflowStep | null | undefined): AssistantMessageEnvelope {
  return {
    role: "user",
    messageType: "system_notice",
    step: step ?? null,
    contentText: message,
    contentJson: { userMessage: message },
    createdAt: new Date().toISOString()
  };
}

function buildStreamPreview(message: AssistantMessageEnvelope) {
  const json = message.contentJson as Record<string, unknown>;

  if (message.messageType === "topic_confirm") {
    const dataDictionary = Array.isArray(json.dataDictionary) ? json.dataDictionary : [];
    return [
      textValue(json.normalizedTopic) || "已生成研究设定摘要。",
      textValue(json.independentVariable) ? `解释变量：${textValue(json.independentVariable)}` : "",
      textValue(json.dependentVariable) ? `被解释变量：${textValue(json.dependentVariable)}` : "",
      normalizeResearchObjectText(json.researchObject) ? `研究对象：${normalizeResearchObjectText(json.researchObject)}` : "",
      dataDictionary.length > 0 ? `数据字典：已识别 ${dataDictionary.length} 个字段` : "",
      "如无问题，请确认并直接生成整套 Stata 工作流。"
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (message.messageType === "sop_guide") {
    const steps = listValue(json.steps).map((step, index) => `${index + 1}. ${step}`);
    return [normalizeAssistantCopy(message.contentText) || "已生成研究路径建议。", ...steps].filter(Boolean).join("\n");
  }

  if (message.messageType === "skill_output") {
    const variableDesign = listValue(json.variableDesign);
    const readingGuide = listValue(json.interpretationGuide || json.checkItems);

    return [
      textValue(json.purpose) || normalizeAssistantCopy(message.contentText) || "已生成当前内容。",
      textValue(json.meaning),
      variableDesign.length > 0 ? `变量与模型：${variableDesign.join("；")}` : "",
      readingGuide.length > 0 ? `阅读重点：${readingGuide.slice(0, 3).join("；")}` : "",
      textValue(json.nextSuggestion)
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (message.messageType === "research_chat") {
    const actions = listValue(json.suggestedNextActions);
    return [
      normalizeAssistantCopy(message.contentText) || textValue(json.answer) || "已完成研究问答。",
      actions.length > 0 ? `建议下一步：${actions.join("；")}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (message.messageType === "result_interpret") {
    return [
      textValue(json.plainExplanation) || normalizeAssistantCopy(message.contentText) || "已完成结果解读。",
      textValue(json.paperStyleExplanation),
      textValue(json.nextSuggestion)
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  if (message.messageType === "stata_error_fix") {
    return [
      textValue(json.errorType) ? `错误类型：${textValue(json.errorType)}` : "",
      textValue(json.explanation) || normalizeAssistantCopy(message.contentText) || "已定位报错原因。",
      textValue(json.retryMessage)
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return normalizeAssistantCopy(message.contentText) || normalizeAssistantCopy(textValue(json.message)) || textValue(json.reason) || "Tank 已完成这一轮输出。";
}

function getStageMessages(messages: AssistantMessageEnvelope[], stage: StageDefinition) {
  const replaceableMessageTypes = new Set(["topic_confirm", "sop_guide", "skill_output"]);
  const stageMessages = messages.filter(
    (message) => message.role !== "user" && Boolean(message.step) && stage.steps.includes(message.step as WorkflowStep)
  );

  if (stage.id === "topic") {
    const latestTopicConfirm = [...stageMessages].reverse().find((message) => message.messageType === "topic_confirm");
    if (latestTopicConfirm) {
      return [latestTopicConfirm];
    }
  }

  const latestIndexByKey = new Map<string, number>();

  stageMessages.forEach((message, index) => {
    if (!replaceableMessageTypes.has(message.messageType)) {
      return;
    }

    latestIndexByKey.set(`${message.step ?? "none"}:${message.messageType}`, index);
  });

  return stageMessages.filter((message, index) => {
    if (!replaceableMessageTypes.has(message.messageType)) {
      return true;
    }

    return latestIndexByKey.get(`${message.step ?? "none"}:${message.messageType}`) === index;
  });
}

function getStageMeta(detail: ProjectDetail | null, activeStageId: StageId) {
  const activeIndex = WORKFLOW_STAGES.findIndex((stage) => stage.id === activeStageId);
  const stepStatusMap = new Map((detail?.steps ?? []).map((step) => [step.step, step.status]));

  return WORKFLOW_STAGES.map((stage, index) => {
    const relevantStatuses = stage.steps.map((step) => stepStatusMap.get(step)).filter(Boolean);
    const isActive = stage.id === activeStageId;
    const isCompleted =
      !isActive &&
      (relevantStatuses.length > 0
        ? relevantStatuses.every((status) => status === "COMPLETED" || status === "SKIPPED")
        : index < activeIndex);

    return {
      ...stage,
      isActive,
      isCompleted
    };
  });
}

function normalizeListItems(value: unknown) {
  const cleanItem = (item: string) =>
    item
      .replace(/；?DID\s*扩展默认不做[，,、；\s]*/gi, "")
      .replace(/；?PSM\s*扩展默认不做[，,、；\s]*/gi, "")
      .replace(/工具变量：待补充真实工具变量；?/g, "")
      .replace(/机制变量：可后续补充；?/g, "")
      .replace(/异质性分组：可后续补充；?/g, "")
      .replace(/导出格式：[^；\n。]+[；。]?/g, "")
      .replace(/系统只给选择标准，不编造\s*\S*/g, "")
      .trim();

  if (!Array.isArray(value)) {
    const text = cleanItem(normalizeDisplayText(value));
    return text && !/默认不做|待补充真实|可后续补充/.test(text) ? [text] : [];
  }

  return value
    .map((item) => cleanItem(normalizeDisplayText(item)))
    .filter((item) => item && !/默认不做|待补充真实|可后续补充|系统只给选择标准|^导出格式/.test(item));
}

function CompactList({ items, emptyText = "暂无内容。" }: { items: string[]; emptyText?: string }) {
  if (items.length === 0) {
    return <p className="text-sm leading-7 text-slate-500">{emptyText}</p>;
  }

  return (
    <ul className="space-y-1.5 text-sm leading-7 text-slate-700">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2">
          <span className="mt-[0.72em] h-1 w-1 shrink-0 rounded-full bg-slate-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ProfileValue({ value }: { value: unknown }) {
  const items = normalizeListItems(value);
  if (items.length === 0) {
    return null;
  }
  return <span>{items.join("、")}</span>;
}

function isStructuralStageMessage(message: AssistantMessageEnvelope) {
  return message.messageType === "topic_confirm" || message.messageType === "sop_guide" || message.messageType === "skill_output";
}

function getLatestStructuralMessages(messages: AssistantMessageEnvelope[], stage: StageDefinition) {
  return getStageMessages(messages, stage).filter(isStructuralStageMessage);
}

function collectTermMappings(detail: ProjectDetail | null, messages: AssistantMessageEnvelope[]) {
  const profileMappings = detail?.researchProfile?.termMappings ?? [];
  if (profileMappings.length > 0) {
    return profileMappings;
  }

  const byKey = new Map<string, TermMapping>();
  messages.forEach((message) => {
    const json = message.contentJson as Record<string, unknown>;
    const mappings = Array.isArray(json.termMappings) ? (json.termMappings as TermMapping[]) : [];
    mappings.forEach((mapping) => {
      if (mapping?.alias || mapping?.labelCn) {
        byKey.set(`${mapping.category}-${mapping.alias}-${mapping.labelCn}`, mapping);
      }
    });
  });
  return Array.from(byKey.values());
}

function collectDataDictionary(detail: ProjectDetail | null, messages: AssistantMessageEnvelope[]) {
  const profileDictionary = detail?.researchProfile?.dataDictionary ?? [];
  if (profileDictionary.length > 0) {
    return profileDictionary;
  }

  const byName = new Map<string, DataDictionaryEntry>();
  messages.forEach((message) => {
    const json = message.contentJson as Record<string, unknown>;
    const entries = Array.isArray(json.dataDictionary) ? (json.dataDictionary as DataDictionaryEntry[]) : [];
    entries.forEach((entry) => {
      if (entry?.variableName) {
        byName.set(entry.variableName, entry);
      }
    });
  });
  return Array.from(byName.values());
}

function normalizeMappingCategory(role: DataDictionaryEntry["candidateRole"]): TermMapping["category"] {
  if (role === "dependent" || role === "independent" || role === "control" || role === "fixed_effect" || role === "cluster" || role === "panel" || role === "time") {
    return role;
  }

  return "control";
}

function buildStageSections(stage: StageDefinition, messages: AssistantMessageEnvelope[]): StageSectionContent {
  const structuralMessages = getLatestStructuralMessages(messages, stage);
  const primary = structuralMessages[structuralMessages.length - 1] ?? null;
  const json = (primary?.contentJson ?? {}) as Record<string, unknown>;
  const topicDraft = (json.currentDraft && typeof json.currentDraft === "object" ? json.currentDraft : json) as Record<string, unknown>;
  const stataCodes = structuralMessages
    .map((message) => normalizeDisplayText((message.contentJson as Record<string, unknown>).stataCode))
    .filter(Boolean);

  if (stage.id === "topic") {
    return {
      goal: (
        <div className="space-y-3">
          <p className="text-sm leading-7 text-slate-700">
            {normalizeDisplayText(topicDraft.normalizedTopic) || "确认研究主题、变量设定和样本范围。"}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {([
              ["解释变量", topicDraft.independentVariable],
              ["被解释变量", topicDraft.dependentVariable],
              ["研究对象", normalizeResearchObjectText(topicDraft.researchObject)],
              ["样本区间", topicDraft.sampleScope]
            ] as Array<[string, unknown]>).map(([label, value]) =>
              normalizeDisplayText(value) ? (
                <div key={String(label)} className="rounded-[12px] bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{normalizeDisplayText(value)}</p>
                </div>
              ) : null
            )}
          </div>
        </div>
      ),
      stataCode: <p className="text-sm leading-7 text-slate-500">主题确认阶段不需要执行 Stata 代码。</p>,
      codeExplanation: <p className="text-sm leading-7 text-slate-600">这一页用于确认研究设定。确认后，其余模块会基于这些设定生成代码与说明。</p>,
      readingAdvice: <p className="text-sm leading-7 text-slate-600">重点检查核心解释变量、被解释变量、样本区间、固定效应和控制变量是否符合论文设计。</p>
    };
  }

  // 本节目标从这里源头去重：基准回归及后续模块只展示模块目的，不再拼接研究设定摘要或 variableDesign。
  const moduleGoalItems = MODULE_GOAL_ITEMS[stage.id];
  const goalItems = moduleGoalItems ?? [
    normalizeDisplayText(json.purpose) || normalizeAssistantCopy(primary?.contentText) || (primary ? buildStreamPreview(primary) : ""),
    normalizeDisplayText(json.meaning),
    ...normalizeListItems(json.variableDesign)
  ].filter(Boolean);
  const explanationItems = [
    normalizeDisplayText(json.modelSpec),
    ...normalizeListItems(json.codeExplanation),
    ...normalizeListItems(json.steps)
  ].filter(Boolean);
  const adviceItems = [
    ...normalizeListItems(json.interpretationGuide),
    ...normalizeListItems(json.checkItems),
    normalizeDisplayText(json.nextSuggestion)
  ].filter(Boolean);

  return {
    goal: <CompactList items={goalItems} emptyText="该模块还没有生成目标说明。" />,
    stataCode:
      stataCodes.length > 0 ? (
        <div className="space-y-3">
          {stataCodes.map((code, index) => (
            <StataCodeBlock code={code} key={`${stage.id}-code-${index}`} title="Stata 代码" />
          ))}
        </div>
      ) : (
        <p className="text-sm leading-7 text-slate-500">该模块暂时没有生成 Stata 代码。</p>
      ),
    codeExplanation: <CompactList items={explanationItems} emptyText="该模块还没有生成代码解读。" />,
    readingAdvice: <CompactList items={adviceItems} emptyText="该模块还没有生成阅读建议。" />
  };
}

function AccordionPanel({
  title,
  open,
  onToggle,
  children
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <button
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
        onClick={onToggle}
        type="button"
      >
        <span className="text-[15px] font-semibold text-slate-950">{title}</span>
        <span
          aria-hidden="true"
          className={clsx("text-slate-400 transition-transform duration-200", open ? "rotate-180" : "rotate-0")}
        >
          ↓
        </span>
      </button>
      {open ? <div className="border-t border-slate-100 px-5 py-4">{children}</div> : null}
    </section>
  );
}

function WorkspaceSidebar({
  stages,
  selectedStageId,
  confirmProcessing,
  onSelect
}: {
  stages: Array<StageDefinition & { isCompleted: boolean; isActive: boolean }>;
  selectedStageId: StageId;
  confirmProcessing: boolean;
  onSelect: (stageId: StageId) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }

      setMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [menuOpen]);

  return (
    <aside className="flex min-h-0 flex-col rounded-[28px] border border-slate-200 bg-white px-4 py-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
      <div className="px-2">
        <p className="text-[34px] font-black leading-none tracking-normal text-slate-950 [font-family:Arial_Rounded_MT_Bold,Trebuchet_MS,sans-serif]">
          Tank
        </p>
        <p className="mt-2 text-xs font-medium text-slate-500">你的科研助理</p>
      </div>

      <nav className="mt-8 flex-1 space-y-1 overflow-y-auto">
        {stages.map((stage, index) => {
          const selected = selectedStageId === stage.id;
          return (
            <button
              className={clsx(
                "flex w-full items-center gap-3 rounded-[16px] px-3 py-3 text-left transition",
                selected ? "bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.14)]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950",
                confirmProcessing ? "cursor-default" : ""
              )}
              disabled={confirmProcessing}
              key={stage.id}
              onClick={() => onSelect(stage.id)}
              type="button"
            >
              <span className={clsx("text-xs font-semibold", selected ? "text-white/70" : "text-slate-400")}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="text-sm font-semibold">{stage.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="relative mt-5">
        {menuOpen ? (
          <div
            className="absolute bottom-full left-0 mb-2 w-full rounded-[16px] border border-slate-200 bg-white p-2 text-sm shadow-[0_18px_42px_rgba(15,23,42,0.12)]"
            ref={menuRef}
          >
            <Link className="block rounded-[12px] px-3 py-2 text-slate-700 hover:bg-slate-50" href="/projects" onClick={() => setMenuOpen(false)}>
              历史项目
            </Link>
            <Link className="block rounded-[12px] px-3 py-2 text-slate-700 hover:bg-slate-50" href="/" onClick={() => setMenuOpen(false)}>
              新建项目
            </Link>
          </div>
        ) : null}
        <button
          aria-expanded={menuOpen}
          aria-label="打开项目菜单"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
          onClick={() => setMenuOpen((current) => !current)}
          ref={triggerRef}
          type="button"
        >
          ···
        </button>
      </div>
    </aside>
  );
}

function WorkspaceRightPanel({
  profile,
  mappings,
  dictionary
}: {
  profile: ResearchProfile | null | undefined;
  mappings: TermMapping[];
  dictionary: DataDictionaryEntry[];
}) {
  const profileRows = [
    ["被解释变量", profile?.dependentVariable],
    ["核心解释变量", profile?.independentVariable],
    ["控制变量", profile?.controls],
    ["固定效应", profile?.fixedEffects],
    ["样本区间", profile?.sampleScope],
    ["聚类变量", profile?.clusterVar || profile?.panelId || "stkcd"]
  ].filter(([, value]) => normalizeListItems(value).length > 0);
  const mappingRows = mappings.length > 0
    ? mappings
    : dictionary.slice(0, 8).map<TermMapping>((entry) => ({
        category: normalizeMappingCategory(entry.candidateRole),
        labelCn: normalizeDisplayText(entry.labelCn || entry.description || entry.variableName),
        alias: entry.variableName
      }));

  return (
    <aside className="hidden-scrollbar hidden min-h-0 flex-col gap-4 overflow-y-auto rounded-[28px] bg-[#F8FAFC] lg:flex">
      <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <h2 className="text-sm font-semibold text-slate-950">研究设定</h2>
        <div className="mt-4 space-y-3">
          {profileRows.length > 0 ? (
            profileRows.map(([label, value]) => (
              <div key={String(label)} className="border-b border-slate-100 pb-2.5 last:border-b-0 last:pb-0">
                <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-900">
                  <ProfileValue value={value} />
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm leading-7 text-slate-500">暂无研究设定。</p>
          )}
        </div>
      </section>

      <section className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.05)]">
        <h2 className="text-sm font-semibold text-slate-950">变量映射</h2>
        <div className="mt-4 overflow-hidden rounded-[14px] border border-slate-200">
          <div className="grid grid-cols-[1fr_0.9fr_0.8fr] gap-2 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
            <span>中文名称</span>
            <span>英文缩写</span>
            <span>类别</span>
          </div>
          {mappingRows.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {mappingRows.slice(0, 10).map((mapping, index) => (
                <div key={`${mapping.alias}-${index}`} className="grid grid-cols-[1fr_0.9fr_0.8fr] gap-2 px-3 py-2.5 text-xs leading-5">
                  <span className="break-words font-medium text-slate-800">{normalizeDisplayText(mapping.labelCn)}</span>
                  <code className="break-words font-mono text-slate-700">{normalizeDisplayText(mapping.alias)}</code>
                  <span className="text-slate-500">{TERM_CATEGORY_LABELS[mapping.category]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-3 py-4 text-sm text-slate-500">暂无变量映射。</p>
          )}
        </div>
      </section>
    </aside>
  );
}

function WorkspaceAssistantDrawer({
  messages,
  input,
  attachments,
  sending,
  attachmentProcessing,
  listening,
  composerError,
  confirmProcessing,
  onChange,
  onSend,
  onAttachClick,
  onMicClick,
  onPaste,
  onRemoveAttachment,
  onStop
}: {
  messages: AssistantPanelMessage[];
  input: string;
  attachments: ComposerAttachment[];
  sending: boolean;
  attachmentProcessing: boolean;
  listening: boolean;
  composerError: string;
  confirmProcessing: boolean;
  onChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  onAttachClick: () => void;
  onMicClick: () => void;
  onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onRemoveAttachment: (index?: number) => void;
  onStop: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    if (!stickToBottomRef.current) {
      return;
    }

    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, sending]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    stickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  };

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-[#E5EAF2] bg-white/95 shadow-[-18px_0_48px_rgba(15,23,42,0.13)] ring-1 ring-white/70 backdrop-blur-xl transition-[transform,opacity] duration-[180ms] ease-out">
      <div className="hidden-scrollbar flex-1 overflow-y-auto px-5 py-5" onScroll={handleScroll} ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="pt-[120px] text-center">
            <p className="text-[24px] font-semibold italic leading-8 text-slate-950">Hi，我是 Tank</p>
            <p className="mt-2 text-base leading-7 text-[#4B5563]">有什么我可以帮你的吗？</p>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message) => (
              <div
                className={clsx(
                  "whitespace-pre-wrap break-words text-sm",
                  message.role === "user"
                    ? "ml-auto max-w-[78%] rounded-[16px] bg-[#F2F4F7] px-3.5 py-3 leading-6 text-[#111827]"
                    : "mr-auto max-w-[92%] leading-[1.65] text-[#111827]"
                )}
                key={message.id}
              >
                {message.role === "assistant" ? (
                  <p className="mb-1 text-xs font-semibold text-slate-400">Tank</p>
                ) : null}
                {message.role === "assistant" && message.status === "loading" && !message.text ? (
                  <TypingDots />
                ) : message.role === "assistant" ? (
                  <FormattedText text={message.text} />
                ) : (
                  message.text
                )}
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[#E5EAF2] bg-white p-4">
        <ChatComposer
          attachments={attachments}
          attachmentProcessing={attachmentProcessing}
          disabled={confirmProcessing}
          error={composerError}
          listening={listening}
          maxHeight={140}
          minHeight={44}
          onAttachClick={onAttachClick}
          onChange={onChange}
          onMicClick={onMicClick}
          onPaste={onPaste}
          onRemoveAttachment={onRemoveAttachment}
          onSend={onSend}
          onStop={onStop}
          placeholder="向 AI 助手提问…"
          sending={sending}
          value={input}
          variant="assistantDrawer"
        />
      </div>
    </aside>
  );
}

function WorkspacePlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1680px] px-6 pb-8 pt-6">
      <div className="rounded-[20px] border border-slate-200 bg-white p-6 text-sm font-normal text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {children}
      </div>
    </div>
  );
}

function WorkspaceStageLoadingCard({
  description
}: {
  description: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {description ? <p className="text-sm font-normal leading-7 text-slate-600">{description}</p> : null}
      <div className="mt-5 space-y-3">
        <div className="h-4 w-40 animate-pulse rounded-full bg-slate-100" />
        <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="h-4 w-4/5 animate-pulse rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

export function ResearchWorkspace({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [stored, setStored] = useState<ReturnType<typeof getStoredProject> | undefined>(undefined);
  const [availableProjects, setAvailableProjects] = useState<ReturnType<typeof getStoredProjects>>([]);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [messages, setMessages] = useState<AssistantMessageEnvelope[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [composerError, setComposerError] = useState("");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [attachmentProcessing, setAttachmentProcessing] = useState(false);
  const [listening, setListening] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<StageId>("topic");
  const [liveTurn, setLiveTurn] = useState<LiveTurnState | null>(null);
  const [confirmProcessing, setConfirmProcessing] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgressPayload | null>(null);
  const [bootstrapResolved, setBootstrapResolved] = useState(false);
  const [pageEntered, setPageEntered] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Keep detail assistant messages in the parent so closing the drawer only hides UI and never resets history.
  const [assistantMessages, setAssistantMessages] = useState<AssistantPanelMessage[]>([]);
  const [accordionOpenState, setAccordionOpenState] = useState<Partial<Record<StageId, AccordionState>>>({});

  const [pendingBootstrapTopic, setPendingBootstrapTopic] = useState<string | null>(null);
  const [initializingProject, setInitializingProject] = useState(false);
  const [optimisticStageId, setOptimisticStageId] = useState<StageId | null>(null);
  const finalizedTurnIdRef = useRef<string | null>(null);
  const bootstrapStartedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseTextRef = useRef("");
  const speechCommittedTextRef = useRef("");
  const speechInterimTextRef = useRef("");
  const keepListeningRef = useRef(false);
  const assistantAbortControllerRef = useRef<AbortController | null>(null);
  const assistantPlaceholderIdRef = useRef<string | null>(null);
  const autoStageRef = useRef<StageId>("topic");

  useIsomorphicLayoutEffect(() => {
    const pendingBootstrap = getPendingProjectBootstrap(projectId);
    const hasHydratedBootstrap = Boolean(pendingBootstrap?.detail && pendingBootstrap?.messages);
    const shouldRunConfirmedBootstrap = Boolean(
      pendingBootstrap?.topic && /确认|confirm|ok|yes/i.test(pendingBootstrap.topic) && !hasHydratedBootstrap
    );

    setStored(getStoredProject(projectId));
    setAvailableProjects(getStoredProjects());
    setDetail(hasHydratedBootstrap ? pendingBootstrap?.detail ?? null : null);
    setMessages(hasHydratedBootstrap ? pendingBootstrap?.messages ?? [] : []);
    setLoading(!hasHydratedBootstrap);
    setLiveTurn(null);
    setError("");
    setComposerError("");
    setInput("");
    setAttachments([]);
    setAttachmentProcessing(false);
    setListening(false);
    setSelectedStageId("topic");
    setPendingBootstrapTopic(hasHydratedBootstrap ? null : pendingBootstrap?.topic ?? null);
    setInitializingProject(Boolean(pendingBootstrap?.topic) && !hasHydratedBootstrap);
    setOptimisticStageId(shouldRunConfirmedBootstrap ? "data" : null);
    setConfirmProcessing(shouldRunConfirmedBootstrap);
    setWorkflowProgress(null);
    setBootstrapResolved(true);
    setPageEntered(false);
    setAssistantOpen(false);
    setAssistantMessages([]);
    setAccordionOpenState({});
    finalizedTurnIdRef.current = null;
    bootstrapStartedRef.current = false;
    keepListeningRef.current = false;
    speechCommittedTextRef.current = "";
    speechInterimTextRef.current = "";
    assistantAbortControllerRef.current?.abort();
    assistantAbortControllerRef.current = null;
    assistantPlaceholderIdRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, [projectId]);

  useEffect(() => {
    if (!bootstrapResolved) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setPageEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [bootstrapResolved, projectId]);

  useEffect(() => {
    if (stored !== null || availableProjects.length !== 1) {
      return;
    }

    const fallbackProject = availableProjects[0];
    if (!fallbackProject || fallbackProject.id === projectId) {
      return;
    }

    router.replace(`/projects/${fallbackProject.id}`);
  }, [availableProjects, projectId, router, stored]);

  useEffect(() => {
    return () => {
      keepListeningRef.current = false;
      speechCommittedTextRef.current = "";
      speechInterimTextRef.current = "";
      assistantAbortControllerRef.current?.abort();
      assistantAbortControllerRef.current = null;
      assistantPlaceholderIdRef.current = null;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (stored === undefined) {
      return;
    }

    if (!stored) {
      setLoading(false);
      return;
    }

    let ignore = false;

    const load = async () => {
      const hasBootstrapData = Boolean(getPendingProjectBootstrap(projectId)?.detail && getPendingProjectBootstrap(projectId)?.messages);

      try {
        if (!hasBootstrapData) {
          setLoading(true);
        }
        const [detailData, messageData] = await Promise.all([
          apiRequest<ProjectDetail>(`/projects/${projectId}`, { token: stored.token }),
          apiRequest<AssistantMessageEnvelope[]>(`/projects/${projectId}/messages`, { token: stored.token })
        ]);

        if (ignore) {
          return;
        }

        setDetail(detailData);
        setMessages(messageData);
        setError("");
        clearPendingProjectBootstrap(projectId);
      } catch (requestError) {
        if (!ignore) {
          setError(requestError instanceof Error ? requestError.message : "加载项目失败，请稍后重试。");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      ignore = true;
    };
  }, [projectId, stored]);

  useEffect(() => {
    if (!stored || loading) {
      return;
    }

    let ignore = false;

    void (async () => {
      try {
        const activeRun = await apiRequest<AgentRunSummary | null>(`/projects/${projectId}/harness/runs/active`, {
          token: stored.token
        });
        if (ignore || !activeRun || activeRun.status !== "running") {
          return;
        }

        const heartbeatTime = activeRun.lastHeartbeatAt ? Date.parse(activeRun.lastHeartbeatAt) : 0;
        if (!heartbeatTime || Date.now() - heartbeatTime > 30000) {
          return;
        }

        setConfirmProcessing(true);
        setWorkflowProgress({
          currentCount: activeRun.currentCount || 1,
          totalCount: activeRun.totalCount || 7,
          stageLabel: activeRun.stageLabel || "研究设定",
          remainingMinutes: 5,
          percent: activeRun.progressPercent || 8
        });
      } catch {
        // Active run recovery is best effort; normal project rendering still works without it.
      }
    })();

    return () => {
      ignore = true;
    };
  }, [loading, projectId, stored]);

  const currentStep = detail?.project.currentStep ?? WorkflowStep.TOPIC_DETECT;
  const activeStageId = STAGE_ID_BY_STEP[currentStep] ?? "topic";
  const progressStageId = workflowProgress?.stageLabel
    ? STAGE_ID_BY_PROGRESS_LABEL[workflowProgress.stageLabel] ?? null
    : null;
  const currentProcessStageId = confirmProcessing
    ? progressStageId ?? optimisticStageId ?? activeStageId
    : optimisticStageId ?? activeStageId;

  useEffect(() => {
    const nextAutoStageId = confirmProcessing ? currentProcessStageId : activeStageId;
    if (autoStageRef.current === nextAutoStageId) {
      return;
    }

    autoStageRef.current = nextAutoStageId;
    setSelectedStageId(nextAutoStageId);
  }, [activeStageId, confirmProcessing, currentProcessStageId]);

  const selectedStage = useMemo(
    () => WORKFLOW_STAGES.find((stage) => stage.id === selectedStageId) ?? WORKFLOW_STAGES[0],
    [selectedStageId]
  );
  const stageMeta = useMemo(() => getStageMeta(detail, currentProcessStageId), [detail, currentProcessStageId]);
  const selectedStageMessages = useMemo(() => getStageMessages(messages, selectedStage), [messages, selectedStage]);
  const pendingBootstrapIsConfirmation = Boolean(pendingBootstrapTopic && /确认|confirm|ok|yes/i.test(pendingBootstrapTopic));
  const showInitialProjectLoading =
    Boolean(pendingBootstrapTopic) && !pendingBootstrapIsConfirmation && (stored === undefined || loading || messages.length === 0);
  const showStageLoadingState = Boolean(confirmProcessing && selectedStage.id === currentProcessStageId && selectedStageMessages.length === 0);
  const selectedAccordionState = accordionOpenState[selectedStage.id] ?? DEFAULT_ACCORDION_STATE;
  const selectedStageSections = useMemo(
    () => buildStageSections(selectedStage, messages),
    [messages, selectedStage]
  );
  const termMappings = useMemo(() => collectTermMappings(detail, messages), [detail, messages]);
  const dataDictionary = useMemo(() => collectDataDictionary(detail, messages), [detail, messages]);

  const toggleAccordion = (key: AccordionKey) => {
    setAccordionOpenState((current) => {
      const previous = current[selectedStage.id] ?? DEFAULT_ACCORDION_STATE;
      return {
        ...current,
        [selectedStage.id]: {
          ...previous,
          [key]: !previous[key]
        }
      };
    });
  };

  useEffect(() => {
    if (!liveTurn || !liveTurn.assistantMessage || !stored || finalizedTurnIdRef.current === liveTurn.id) {
      return;
    }


    finalizedTurnIdRef.current = liveTurn.id;
    const userMessage = liveTurn.userMessage;
    const assistantMessage = liveTurn.assistantMessage;
    let ignore = false;

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setLiveTurn(null);
    setSending(false);
    setInitializingProject(false);

    void (async () => {
      try {
        const nextDetail = await apiRequest<ProjectDetail>(`/projects/${projectId}`, { token: stored.token });
        if (!ignore) {
          setDetail(nextDetail);
          setError("");
          setOptimisticStageId(null);
          setConfirmProcessing(false);
          setWorkflowProgress(null);
        }
      } catch (requestError) {
        if (!ignore) {
          setError(requestError instanceof Error ? requestError.message : "\u5237\u65b0\u9879\u76ee\u72b6\u6001\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002");
          setOptimisticStageId(null);
          setConfirmProcessing(false);
          setWorkflowProgress(null);
        }
      }
    })();

    return () => {
      ignore = true;
    };
  }, [liveTurn, projectId, stored]);

  const streamMessage = async (
    rawMessage: string,
    options: { attachment?: ComposerAttachment | ComposerAttachment[] | null; payload?: Record<string, unknown>; requestedStep?: WorkflowStep } = {}
  ) => {
    if (!stored || sending || attachmentProcessing) {
      return null;
    }

    let resolvedAttachments = Array.isArray(options.attachment)
      ? options.attachment
      : options.attachment
        ? [options.attachment]
        : [];

    if (!rawMessage.trim() && resolvedAttachments.length === 0) {
      return null;
    }

    try {
      resolvedAttachments = await resolveAttachmentsForSubmission(resolvedAttachments);
    } catch (attachmentError) {
      setComposerError(
        attachmentError instanceof Error ? attachmentError.message : "\u622a\u56fe\u8bc6\u522b\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"
      );
      return null;
    }

    const submission = buildComposerSubmission(rawMessage, resolvedAttachments);

    if (!submission.userMessage.trim()) {
      setComposerError("\u622a\u56fe\u4e2d\u6ca1\u6709\u8bc6\u522b\u5230\u53ef\u7528\u6587\u5b57\uff0c\u8bf7\u6362\u4e00\u5f20\u66f4\u6e05\u6670\u7684\u56fe\u7247\u518d\u8bd5\u3002");
      return null;
    }

    const requestedStep =
      options.requestedStep ?? REQUESTED_STEP_BY_STAGE[selectedStageId] ?? detail?.project.currentStep ?? WorkflowStep.TOPIC_NORMALIZE;
    const localUserMessage = createLocalUserMessage(submission.userMessage, requestedStep ?? null);
    const liveTurnId = Date.now() + "-" + Math.random().toString(16).slice(2);

    finalizedTurnIdRef.current = null;
    setLiveTurn({
      id: liveTurnId,
      userMessage: localUserMessage,
      assistantMessage: null,
      phase: WorkflowStreamPhase.THINKING,
      statusText: "Tank正在思考中...",
      streamingText: "",
      error: null
    });
    setSending(true);
    setError("");
    setComposerError("");

    try {
      await streamApiRequest(`/projects/${projectId}/workflow/stream`, {
        token: stored.token,
        body: {
          userMessage: submission.userMessage,
          requestedStep,
          payload: {
            ...submission.payload,
            ...(options.payload ?? {})
          }
        },
        onEvent: (event) => {
          if (event.type === "run") {
            return;
          }

          if (event.type === "status") {
            setLiveTurn((current) => {
              if (!current || current.id !== liveTurnId) {
                return current;
              }

              return {
                ...current,
                phase: event.phase,
                statusText: event.message
              };
            });
            return;
          }

          if (event.type === "progress") {
            setWorkflowProgress(event.progress);
            return;
          }

          if (event.type === "message") {
            setLiveTurn((current) => {
              if (!current || current.id !== liveTurnId) {
                return current;
              }

              return {
                ...current,
                assistantMessage: event.response.assistantMessage,
                phase: WorkflowStreamPhase.TYPING,
                statusText: "Tank正在思考中...",
                streamingText: buildStreamPreview(event.response.assistantMessage)
              };
            });
            return;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      });

      const [nextDetail, nextMessages] = await Promise.all([
        apiRequest<ProjectDetail>(`/projects/${projectId}`, { token: stored.token }),
        apiRequest<AssistantMessageEnvelope[]>(`/projects/${projectId}/messages`, { token: stored.token })
      ]);

      setDetail(nextDetail);
      setMessages(nextMessages);
      setError("");
      setLiveTurn(null);
      setSending(false);
      setInitializingProject(false);
      setOptimisticStageId(null);
      setConfirmProcessing(false);
      setWorkflowProgress(null);
      setInput("");
      setAttachments([]);
      return nextMessages[nextMessages.length - 1] ?? null;
    } catch (requestError) {
      const messageText = requestError instanceof Error ? requestError.message : "发送失败，请稍后重试。";

      setLiveTurn((current) => {
        if (!current || current.id !== liveTurnId) {
          return current;
        }

        return {
          ...current,
          phase: WorkflowStreamPhase.COMPLETE,
          statusText: "稍后再试",
          streamingText: messageText,
          error: messageText
        };
      });
      setError(messageText);
      setSending(false);
      setInitializingProject(false);
      setOptimisticStageId(null);
      setConfirmProcessing(false);
      setWorkflowProgress(null);
      return null;
    }
  };

  useEffect(() => {
    if (!stored || loading || !pendingBootstrapTopic || bootstrapStartedRef.current || sending) {
      return;
    }

    if (messages.length > 0 && !pendingBootstrapIsConfirmation) {
      clearPendingProjectBootstrap(projectId);
      setPendingBootstrapTopic(null);
      setInitializingProject(false);
      return;
    }

    bootstrapStartedRef.current = true;
    clearPendingProjectBootstrap(projectId);

    void (async () => {
      try {
        await streamMessage(pendingBootstrapTopic, {
          requestedStep: pendingBootstrapIsConfirmation ? WorkflowStep.TOPIC_NORMALIZE : undefined
        });
      } finally {
        setPendingBootstrapTopic(null);
        setInitializingProject(false);
      }
    })();
  }, [loading, messages.length, pendingBootstrapIsConfirmation, pendingBootstrapTopic, projectId, sending, stored]);

  const processAttachment = async (file: File) => {
    const normalizedFile = ensureNamedImageFile(file);

    if (normalizedFile.type.startsWith("image/")) {
      setComposerError("");
      setAttachments((current) => [...current, buildPendingImageAttachment(normalizedFile)]);
      return;
    }

    try {
      setComposerError("");
      setAttachmentProcessing(true);
      const nextAttachment = await readComposerAttachment(normalizedFile, {
        onStatus: () => {}
      });
      setAttachments((current) => [...current, nextAttachment]);
    } catch (attachmentError) {
      setComposerError(
        attachmentError instanceof Error ? attachmentError.message : "文件读取失败，请稍后重试。"
      );
    } finally {
      setAttachmentProcessing(false);
    }
  };

  const handleAttachmentPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      await processAttachment(file);
    }
  };

  const resolveAttachmentsForSubmission = async (nextAttachments: ComposerAttachment[]) => {
    const resolved: ComposerAttachment[] = [];
    for (const nextAttachment of nextAttachments) {
      if (nextAttachment.source !== "image" || !nextAttachment.file || nextAttachment.processed) {
        resolved.push(nextAttachment);
        continue;
      }

      try {
        setComposerError("");
        setAttachmentProcessing(true);
        resolved.push(await readImageAttachment(nextAttachment.file, () => {}));
      } finally {
        setAttachmentProcessing(false);
      }
    }
    return resolved;
  };

  const handleComposerPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const imageItem = Array.from(event.clipboardData.items).find((item) => item.type.startsWith("image/"));

    if (!imageItem) {
      return;
    }

    const file = imageItem.getAsFile();
    if (!file) {
      return;
    }

    event.preventDefault();
    void processAttachment(file);
  };

  const handleMicClick = () => {
    if (sending || attachmentProcessing) {
      return;
    }

    if (listening) {
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      return;
    }

    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructorLike;
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
    };
    const SpeechRecognitionCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setComposerError("当前浏览器暂不支持语音输入。");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    speechBaseTextRef.current = input.trim();
    speechCommittedTextRef.current = "";
    speechInterimTextRef.current = "";
    setComposerError("");
    setListening(true);
    keepListeningRef.current = true;
    recognitionRef.current = recognition;
    recognition.lang = inferSpeechRecognitionLanguage(input);
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 3;

    recognition.onresult = (event) => {
      let nextCommitted = speechCommittedTextRef.current;
      const interimChunks: string[] = [];

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const chunk = result?.[0]?.transcript?.trim();
        if (!chunk) {
          continue;
        }

        if (result.isFinal) {
          nextCommitted = appendCommittedSpeech(nextCommitted, chunk);
        } else {
          interimChunks.push(chunk);
        }
      }

      speechCommittedTextRef.current = nextCommitted;
      speechInterimTextRef.current = interimChunks.join("");
      setInput(
        buildSpeechText(
          speechBaseTextRef.current,
          speechCommittedTextRef.current,
          speechInterimTextRef.current
        )
      );
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
        keepListeningRef.current = false;
        setListening(false);
        recognitionRef.current = null;
      }

      if (event.error !== "aborted") {
        setComposerError(
          event.error === "not-allowed"
            ? "请先允许浏览器使用麦克风。"
            : event.error === "service-not-allowed"
              ? "当前浏览器禁止了语音识别服务。"
              : event.error === "audio-capture"
                ? "没有检测到可用麦克风。"
                : "语音识别失败，请重试。"
        );
      }
    };

    recognition.onend = () => {
      if (keepListeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          keepListeningRef.current = false;
          setComposerError("语音识别中断，请重新开始。");
        }
      }

      setInput(
        finalizeSpeechText(
          speechBaseTextRef.current,
          speechCommittedTextRef.current,
          speechInterimTextRef.current
        )
      );
      speechCommittedTextRef.current = "";
      speechInterimTextRef.current = "";
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
  };

  const stopAssistantMessage = () => {
    assistantAbortControllerRef.current?.abort();
    assistantAbortControllerRef.current = null;

    const placeholderId = assistantPlaceholderIdRef.current;
    if (placeholderId) {
      setAssistantMessages((current) =>
        current.flatMap((message) => {
          if (message.id !== placeholderId) {
            return [message];
          }

          return message.text.trim() ? [{ ...message, status: "stopped" as const }] : [];
        })
      );
      assistantPlaceholderIdRef.current = null;
    }

    setSending(false);
  };

  const sendAssistantMessage = async () => {
    const question = input.trim();
    if (!stored || (!question && attachments.length === 0) || sending || confirmProcessing || attachmentProcessing) {
      return;
    }

    const localId = Date.now().toString(16);
    const assistantMessageId = `${localId}-assistant`;
    const currentAttachments = attachments;
    const userDisplayText = question || currentAttachments.map((item) => item.name).join("、") || "";
    const requestedStep = REQUESTED_STEP_BY_STAGE[selectedStageId] ?? detail?.project.currentStep ?? WorkflowStep.TOPIC_NORMALIZE;
    const controller = new AbortController();
    let assistantPlaceholderInserted = false;

    try {
      setSending(true);
      setComposerError("");
      setInput("");
      setAttachments([]);
      assistantAbortControllerRef.current = controller;
      assistantPlaceholderIdRef.current = assistantMessageId;

      const resolvedAttachments = await resolveAttachmentsForSubmission(currentAttachments);
      const submission = buildComposerSubmission(question, resolvedAttachments);
      const submittedQuestion = submission.userMessage.trim();

      if (!submittedQuestion) {
        throw new Error("附件中没有识别到可用文字，请换一个更清晰的文件再试。");
      }

      setAssistantMessages((current) => [
        ...current,
        {
          id: `${localId}-user`,
          role: "user",
          text: userDisplayText || submittedQuestion
        },
        {
          id: assistantMessageId,
          role: "assistant",
          text: "",
          status: "loading"
        }
      ]);
      assistantPlaceholderInserted = true;

      const response = await apiRequest<WorkflowNextResponse>(`/projects/${projectId}/workflow/next`, {
        method: "POST",
        token: stored.token,
        signal: controller.signal,
        body: JSON.stringify({
          userMessage: submittedQuestion,
          requestedStep,
          payload: {
            ...submission.payload
          }
        })
      });

      const answerText =
        normalizeAssistantCopy(response.assistantMessage.contentText ?? "") ||
        "我已经收到你的问题，但这次没有生成可展示的回答。";
      setAssistantMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                text: answerText,
                status: "done"
              }
            : message
        )
      );
      const [nextDetail, nextMessages] = await Promise.all([
        apiRequest<ProjectDetail>(`/projects/${projectId}`, { token: stored.token }),
        apiRequest<AssistantMessageEnvelope[]>(`/projects/${projectId}/messages`, { token: stored.token })
      ]);
      setDetail(nextDetail);
      setMessages(nextMessages);
    } catch (requestError) {
      if (!isAbortError(requestError)) {
        const messageText = requestError instanceof Error ? requestError.message : "发送失败，请稍后重试。";
        if (assistantPlaceholderInserted) {
          setAssistantMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    text: messageText,
                    status: "error"
                  }
                : message
            )
          );
        } else {
          setComposerError(messageText);
        }
        setInput(question);
        setAttachments(currentAttachments);
      }
    } finally {
      if (assistantAbortControllerRef.current === controller) {
        assistantAbortControllerRef.current = null;
      }
      if (assistantPlaceholderIdRef.current === assistantMessageId) {
        assistantPlaceholderIdRef.current = null;
      }
      setSending(false);
    }
  };

  if (!bootstrapResolved) {
    return <section aria-hidden="true" className="mx-auto max-w-[1100px] px-6 pb-8 pt-6 opacity-0" />;
  }

  if (showInitialProjectLoading) {
    return (
      <WorkspacePlaceholder>
        <ThinkingBubble bare className="w-fit" />
      </WorkspacePlaceholder>
    );
  }

  if ((stored === undefined || loading) && !pendingBootstrapIsConfirmation) {
    return (
      <WorkspacePlaceholder>
        <ThinkingBubble bare className="w-fit" />
      </WorkspacePlaceholder>
    );
  }

  if (stored !== undefined && !stored && availableProjects.length === 1) {
    return (
      <WorkspacePlaceholder>
        <ThinkingBubble bare className="w-fit" />
      </WorkspacePlaceholder>
    );
  }

  if (stored !== undefined && !stored) {
    return (
      <div className="mx-auto max-w-[1680px] px-6 pb-8 pt-6">
        <div className="rounded-[20px] border border-dashed border-slate-300 bg-white p-6 text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
          <p className="text-base font-semibold text-slate-950">这个链接不在当前浏览器保存的项目列表里。</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="inline-flex h-10 items-center rounded-[10px] bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-900"
              href="/projects"
            >
              打开项目库
            </Link>
            <Link
              className="inline-flex h-10 items-center rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              href="/"
            >
              新建项目
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <section
        className={clsx(
          "mx-auto grid h-[calc(100vh-1rem)] max-w-[1760px] grid-cols-1 gap-5 overflow-hidden px-2 pb-0 transition-[opacity,transform] duration-200 sm:h-[calc(100vh-1.25rem)] md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[240px_minmax(0,1fr)_340px] xl:grid-cols-[260px_minmax(0,1fr)_380px]",
          pageEntered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        )}
      >
        <WorkspaceSidebar
          confirmProcessing={confirmProcessing}
          onSelect={setSelectedStageId}
          selectedStageId={selectedStage.id}
          stages={stageMeta}
        />

        <div className="relative min-h-0">
          <main className="hidden-scrollbar h-full min-h-0 overflow-y-auto rounded-[28px] border border-slate-200 bg-white/78 p-5 shadow-[0_18px_55px_rgba(15,23,42,0.06)] md:p-7">
            {error ? (
              <div className="mb-5 rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="mb-6">
              <p className="text-xs font-semibold tracking-[0.18em] text-slate-400">
                {String(WORKFLOW_STAGES.findIndex((stage) => stage.id === selectedStage.id) + 1).padStart(2, "0")}
              </p>
              <h1 className="mt-2 text-[28px] font-semibold leading-tight text-slate-950">{selectedStage.label}</h1>
            </div>

            {showStageLoadingState ? (
              <WorkspaceStageLoadingCard description="" />
            ) : (
              <div className="space-y-3">
                <AccordionPanel
                  onToggle={() => toggleAccordion("goal")}
                  open={selectedAccordionState.goal}
                  title="本节目标"
                >
                  {selectedStageSections.goal}
                </AccordionPanel>
                <AccordionPanel
                  onToggle={() => toggleAccordion("stataCode")}
                  open={selectedAccordionState.stataCode}
                  title="Stata 代码"
                >
                  {selectedStageSections.stataCode}
                </AccordionPanel>
                <AccordionPanel
                  onToggle={() => toggleAccordion("codeExplanation")}
                  open={selectedAccordionState.codeExplanation}
                  title="代码解读"
                >
                  {selectedStageSections.codeExplanation}
                </AccordionPanel>
                <AccordionPanel
                  onToggle={() => toggleAccordion("readingAdvice")}
                  open={selectedAccordionState.readingAdvice}
                  title="阅读建议"
                >
                  {selectedStageSections.readingAdvice}
                </AccordionPanel>
              </div>
            )}
          </main>
        </div>

        <WorkspaceRightPanel
          dictionary={dataDictionary}
          mappings={termMappings}
          profile={detail?.researchProfile}
        />
      </section>

      {!assistantOpen ? (
        <button
          aria-label="打开 AI 助手"
          className="assistant-float-arrow fixed right-0 top-1/2 z-40 inline-flex h-14 w-7 items-center justify-center select-none text-4xl font-light leading-none text-slate-500/80 transition hover:text-slate-950"
          onClick={() => setAssistantOpen(true)}
          type="button"
        >
          ‹
        </button>
      ) : null}

      <div
        className={clsx(
          "fixed inset-0 z-50 transition-opacity duration-[180ms] ease-out",
          assistantOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        <button
          aria-label="关闭 AI 助手"
          className="absolute inset-0 h-full w-full cursor-default bg-transparent"
          onClick={() => setAssistantOpen(false)}
          type="button"
        />
        <div
          className={clsx(
            "absolute bottom-4 right-4 top-4 w-[min(460px,calc(100vw-2rem))] transition-[transform,opacity] duration-[180ms] ease-out",
            assistantOpen ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
          )}
        >
          <WorkspaceAssistantDrawer
            attachments={attachments}
            attachmentProcessing={attachmentProcessing}
            composerError={composerError}
            confirmProcessing={confirmProcessing}
            input={input}
            listening={listening}
            messages={assistantMessages}
            onAttachClick={() => fileInputRef.current?.click()}
            onChange={setInput}
            onMicClick={handleMicClick}
            onPaste={handleComposerPaste}
            onRemoveAttachment={(index = 0) =>
              setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))
            }
            onSend={sendAssistantMessage}
            onStop={stopAssistantMessage}
            sending={sending}
          />
        </div>
      </div>

      <input
        accept={SUPPORTED_ATTACHMENT_ACCEPT}
        className="hidden"
        multiple
        onChange={handleAttachmentPick}
        ref={fileInputRef}
        type="file"
      />

      {/* 旧的确认主题居中蒙版和生成进度弹窗已移除；详情页 AI Drawer 只保留透明外部点击层，不再压灰正文。 */}
    </>
  );
}
