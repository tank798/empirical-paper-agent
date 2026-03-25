"use client";

import clsx from "clsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type ClipboardEvent,
  type ChangeEvent,
  type KeyboardEvent,
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
  type AssistantMessageEnvelope,
  type ProjectDetail,
  type WorkflowProgressPayload,
  type WorkflowStreamPhase as WorkflowStreamPhaseValue
} from "@empirical/shared";
import { apiRequest, streamApiRequest } from "../lib/api";
import { ensureNamedImageFile, extractImageText } from "../lib/image-ocr";
import { appendCommittedSpeech, buildSpeechText, finalizeSpeechText } from "../lib/speech";
import { normalizeAssistantCopy, normalizeDisplayText, normalizeResearchObjectText } from "../lib/message-display";
import { clearPendingProjectBootstrap, getPendingProjectBootstrap, getStoredProject, getStoredProjects } from "../lib/storage";
import { MessageCard } from "./message-card";
import { ThinkingBubble } from "./thinking-bubble";

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

type ComposerAttachment = {
  name: string;
  mimeType: string;
  size: number;
  content: string;
  truncated: boolean;
  source: "file" | "image";
  file: File | null;
  processed: boolean;
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
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

const WORKFLOW_STAGES: StageDefinition[] = [
  { id: "topic", label: "主题确认", steps: [WorkflowStep.TOPIC_DETECT, WorkflowStep.TOPIC_NORMALIZE] },
  { id: "data", label: "数据处理", steps: [WorkflowStep.SOP_GUIDE, WorkflowStep.DATA_CLEANING, WorkflowStep.DATA_CHECK] },
  { id: "baseline", label: "基准回归", steps: [WorkflowStep.BASELINE_REGRESSION] },
  { id: "robustness", label: "稳健性检验", steps: [WorkflowStep.ROBUSTNESS] },
  { id: "iv", label: "内生性分析", steps: [WorkflowStep.IV] },
  { id: "mechanism", label: "机制分析", steps: [WorkflowStep.MECHANISM] },
  { id: "heterogeneity", label: "异质性分析", steps: [WorkflowStep.HETEROGENEITY] }
];

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

const SUPPORTED_ATTACHMENT_EXTENSIONS = new Set([
  "txt",
  "md",
  "csv",
  "json",
  "log",
  "yml",
  "yaml",
  "xml",
  "html",
  "htm",
  "js",
  "ts",
  "tsx",
  "jsx",
  "py",
  "r",
  "sql",
  "tex",
  "do",
  "pdf",
  "docx",
  "xls",
  "xlsx"
]);

const MAX_ATTACHMENT_CHARACTERS = 20000;
const MAX_SPREADSHEET_ROWS = 80;
const MAX_SPREADSHEET_SHEETS = 4;
const SUPPORTED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "bmp", "gif"]);

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
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

function getFileExtension(fileName: string) {
  const segments = fileName.toLowerCase().split(".");
  return segments.length > 1 ? segments[segments.length - 1] ?? "" : "";
}

function normalizeAttachmentText(rawContent: string) {
  return rawContent
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildAttachment(file: File, mimeType: string, rawContent: string, truncated = false): ComposerAttachment {
  const normalized = normalizeAttachmentText(rawContent);

  if (!normalized) {
    throw new Error("\u6587\u4ef6\u4e2d\u6ca1\u6709\u53ef\u8bfb\u53d6\u7684\u5185\u5bb9\uff0c\u8bf7\u6362\u4e00\u4e2a\u6587\u4ef6\u518d\u8bd5\u3002");
  }

  return {
    name: file.name,
    mimeType,
    size: file.size,
    content: normalized.slice(0, MAX_ATTACHMENT_CHARACTERS),
    truncated: truncated || normalized.length > MAX_ATTACHMENT_CHARACTERS,
    source: mimeType.startsWith("image/") ? "image" : "file",
    file: null,
    processed: true
  };
}

function buildPendingImageAttachment(file: File): ComposerAttachment {
  return {
    name: file.name,
    mimeType: file.type || "image/png",
    size: file.size,
    content: "",
    truncated: false,
    source: "image",
    file,
    processed: false
  };
}

function canReadAttachment(file: File) {
  const extension = getFileExtension(file.name);
  return (
    file.type.startsWith("text/") ||
    file.type.startsWith("image/") ||
    SUPPORTED_ATTACHMENT_EXTENSIONS.has(extension) ||
    SUPPORTED_IMAGE_EXTENSIONS.has(extension)
  );
}

async function readPlainTextAttachment(file: File): Promise<ComposerAttachment> {
  const rawContent = await file.text();
  return buildAttachment(file, file.type || "text/plain", rawContent);
}

async function readPdfAttachment(file: File): Promise<ComposerAttachment> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url
    ).toString();
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const document = await pdfjs.getDocument({ data: bytes }).promise;
  const pageTexts: string[] = [];
  let totalLength = 0;
  let truncated = false;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as Array<{ str?: string }>)
      .map((item) => item.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (!pageText) {
      continue;
    }

    const nextChunk = "第" + pageNumber + "页\n" + pageText;
    totalLength += nextChunk.length;
    pageTexts.push(nextChunk);

    if (
      totalLength >= MAX_ATTACHMENT_CHARACTERS ||
      (pageNumber < document.numPages && totalLength >= MAX_ATTACHMENT_CHARACTERS * 0.9)
    ) {
      truncated = pageNumber < document.numPages;
      break;
    }
  }

  return buildAttachment(file, file.type || "application/pdf", pageTexts.join("\n\n"), truncated);
}

async function readDocxAttachment(file: File): Promise<ComposerAttachment> {
  const mammoth = (await import("mammoth")) as {
    extractRawText: (input: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>;
  };
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return buildAttachment(
    file,
    file.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    result.value
  );
}

async function readSpreadsheetAttachment(file: File): Promise<ComposerAttachment> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
  const sheetTexts: string[] = [];
  let truncated = workbook.SheetNames.length > MAX_SPREADSHEET_SHEETS;
  let totalLength = 0;

  for (const sheetName of workbook.SheetNames.slice(0, MAX_SPREADSHEET_SHEETS)) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      continue;
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
      raw: false,
      defval: ""
    }) as Array<Array<string | number | boolean | null>>;

    if (rows.length > MAX_SPREADSHEET_ROWS) {
      truncated = true;
    }

    const previewRows = rows.slice(0, MAX_SPREADSHEET_ROWS).map((row) =>
      row
        .map((cell) => String(cell ?? "").trim())
        .filter(Boolean)
        .join(" | ")
    );
    const body = previewRows.filter(Boolean).join("\n").trim();

    if (!body) {
      continue;
    }

    const nextChunk = "工作表：" + sheetName + "\n" + body;
    totalLength += nextChunk.length;
    sheetTexts.push(nextChunk);

    if (totalLength >= MAX_ATTACHMENT_CHARACTERS) {
      truncated = true;
      break;
    }
  }

  return buildAttachment(
    file,
    file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    sheetTexts.join("\n\n"),
    truncated
  );
}

async function readImageAttachment(
  file: File,
  onStatus?: (statusText: string) => void
): Promise<ComposerAttachment> {
  const rawContent = await extractImageText(file, (status) => onStatus?.(status.text));
  return buildAttachment(file, file.type || "image/png", rawContent);
}

async function readComposerAttachment(
  file: File,
  options: { onStatus?: (statusText: string) => void } = {}
): Promise<ComposerAttachment> {
  if (!canReadAttachment(file)) {
    throw new Error("\u76ee\u524d\u652f\u6301\u6587\u672c\u6587\u4ef6\u3001\u8868\u683c\u3001PDF\u3001Word\uff0c\u4ee5\u53ca\u76f4\u63a5\u7c98\u8d34\u6216\u4e0a\u4f20\u622a\u56fe\u56fe\u7247\u3002");
  }

  const extension = getFileExtension(file.name);

  if (file.type.startsWith("image/") || SUPPORTED_IMAGE_EXTENSIONS.has(extension)) {
    return readImageAttachment(file, options.onStatus);
  }

  if (extension === "pdf") {
    return readPdfAttachment(file);
  }

  if (extension === "docx") {
    return readDocxAttachment(file);
  }

  if (extension === "xls" || extension === "xlsx") {
    return readSpreadsheetAttachment(file);
  }

  return readPlainTextAttachment(file);
}

function formatAttachmentSize(size: number) {
  if (size < 1024) {
    return size + " B";
  }

  if (size < 1024 * 1024) {
    return (size / 1024).toFixed(1) + " KB";
  }

  return (size / (1024 * 1024)).toFixed(1) + " MB";
}

function buildComposerSubmission(rawMessage: string, attachment: ComposerAttachment | null) {
  const baseMessage =
    rawMessage.trim() ||
    (attachment
      ? attachment.source === "image"
        ? "请结合截图识别内容继续处理。"
        : "请结合附件内容继续处理。"
      : "");

  if (!attachment) {
    return {
      userMessage: baseMessage,
      payload: {} as Record<string, unknown>
    };
  }

  const attachmentLines = [
    "文件名：" + attachment.name,
    "类型：" + attachment.mimeType,
    "大小：" + formatAttachmentSize(attachment.size),
    attachment.source === "image" ? "来源：截图 / 图片 OCR" : "来源：文件解析",
    attachment.truncated ? "内容较长，已截断展示" : "内容已完整解析",
    attachment.content
  ];

  return {
    userMessage: [baseMessage, "[附件内容]", attachmentLines.join("\n")].filter(Boolean).join("\n\n"),
    payload: {
      attachment: {
        name: attachment.name,
        mimeType: attachment.mimeType,
        size: attachment.size,
        truncated: attachment.truncated
      }
    }
  };
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 3.333v9.334M3.333 8h9.334"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 2.667A1.833 1.833 0 0 0 6.167 4.5v3A1.833 1.833 0 0 0 8 9.333 1.833 1.833 0 0 0 9.833 7.5v-3A1.833 1.833 0 0 0 8 2.667Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M4.833 6.833a3.167 3.167 0 1 0 6.334 0M8 10.667v2.666M5.667 13.333h4.666"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M5 2.667h4.333L12.667 6v7.333A1.333 1.333 0 0 1 11.333 14.667H5A1.333 1.333 0 0 1 3.667 13.333V4A1.333 1.333 0 0 1 5 2.667Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
      <path d="M9.333 2.667V6h3.334" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
      <path d="m4 4 8 8M12 4 4 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function buildStreamPreview(message: AssistantMessageEnvelope) {
  const json = message.contentJson as Record<string, unknown>;

  if (message.messageType === "topic_confirm") {
    return [
      textValue(json.normalizedTopic) || "已生成研究设定摘要。",
      textValue(json.independentVariable) ? `解释变量：${textValue(json.independentVariable)}` : "",
      textValue(json.dependentVariable) ? `被解释变量：${textValue(json.dependentVariable)}` : "",
      normalizeResearchObjectText(json.researchObject) ? `研究对象：${normalizeResearchObjectText(json.researchObject)}` : "",
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

function WorkspacePlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1100px] px-6 pb-8 pt-6">
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
      <p className="text-sm font-normal leading-7 text-slate-600">{description}</p>
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
  const [attachment, setAttachment] = useState<ComposerAttachment | null>(null);
  const [attachmentProcessing, setAttachmentProcessing] = useState(false);
  const [attachmentStatusText, setAttachmentStatusText] = useState("");
  const [listening, setListening] = useState(false);
  const [selectedStageId, setSelectedStageId] = useState<StageId>("topic");
  const [liveTurn, setLiveTurn] = useState<LiveTurnState | null>(null);
  const [confirmProcessing, setConfirmProcessing] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgressPayload | null>(null);
  const [bootstrapResolved, setBootstrapResolved] = useState(false);
  const [pageEntered, setPageEntered] = useState(false);

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
  const autoStageRef = useRef<StageId>("topic");
  const stageRailRef = useRef<HTMLDivElement | null>(null);
  const stageButtonRefs = useRef<Record<StageId, HTMLButtonElement | null>>({
    topic: null,
    data: null,
    baseline: null,
    robustness: null,
    iv: null,
    mechanism: null,
    heterogeneity: null
  });
  const [stageIndicator, setStageIndicator] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    ready: false
  });

  useIsomorphicLayoutEffect(() => {
    const pendingBootstrap = getPendingProjectBootstrap(projectId);
    const hasHydratedBootstrap = Boolean(pendingBootstrap?.detail && pendingBootstrap?.messages);

    setStored(getStoredProject(projectId));
    setAvailableProjects(getStoredProjects());
    setDetail(hasHydratedBootstrap ? pendingBootstrap?.detail ?? null : null);
    setMessages(hasHydratedBootstrap ? pendingBootstrap?.messages ?? [] : []);
    setLoading(!hasHydratedBootstrap);
    setLiveTurn(null);
    setError("");
    setComposerError("");
    setInput("");
    setAttachment(null);
    setAttachmentProcessing(false);
    setAttachmentStatusText("");
    setListening(false);
    setSelectedStageId("topic");
    setPendingBootstrapTopic(hasHydratedBootstrap ? null : pendingBootstrap?.topic ?? null);
    setInitializingProject(Boolean(pendingBootstrap?.topic) && !hasHydratedBootstrap);
    setOptimisticStageId(null);
    setConfirmProcessing(false);
    setWorkflowProgress(null);
    setBootstrapResolved(true);
    setPageEntered(false);
    finalizedTurnIdRef.current = null;
    bootstrapStartedRef.current = false;
    keepListeningRef.current = false;
    speechCommittedTextRef.current = "";
    speechInterimTextRef.current = "";
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

    const currentStep = detail?.project.currentStep ?? WorkflowStep.TOPIC_DETECT;
  const activeStageId = STAGE_ID_BY_STEP[currentStep] ?? "topic";
  const progressStageId = workflowProgress?.stageLabel
    ? STAGE_ID_BY_PROGRESS_LABEL[workflowProgress.stageLabel] ?? null
    : null;
  const currentProcessStageId = confirmProcessing
    ? progressStageId ?? optimisticStageId ?? activeStageId
    : optimisticStageId ?? activeStageId;
  const highlightedStageId = confirmProcessing ? currentProcessStageId : selectedStageId;

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
  const selectedStageIsActive = selectedStage.id === currentProcessStageId;
  const showInitialProjectLoading = Boolean(pendingBootstrapTopic) && (stored === undefined || loading || messages.length === 0);
  const showStageLoadingState = Boolean(confirmProcessing && selectedStage.id === currentProcessStageId && selectedStageMessages.length === 0);
  const hasDownstreamMessages = messages.some(
    (message) =>
      message.role !== "user" &&
      Boolean(message.step) &&
      STAGE_ID_BY_STEP[message.step as WorkflowStep] &&
      STAGE_ID_BY_STEP[message.step as WorkflowStep] !== "topic"
  );
  const showTopicConfirmBar =
    selectedStage.id === "topic" &&
    selectedStageMessages.some((message) => message.messageType === "topic_confirm") &&
    !hasDownstreamMessages &&
    !confirmProcessing;
  const workflowLockActive = confirmProcessing;
  const workflowLockProgress = workflowProgress ?? {
    currentCount: 1,
    totalCount: 7,
    stageLabel: "\u7814\u7a76\u8bbe\u5b9a",
    remainingMinutes: 5
  };

  useIsomorphicLayoutEffect(() => {
    const rail = stageRailRef.current;
    const button = stageButtonRefs.current[highlightedStageId];
    if (!rail || !button) {
      return;
    }

    const nextIndicator = {
      left: button.offsetLeft,
      top: button.offsetTop,
      width: button.offsetWidth,
      height: button.offsetHeight,
      ready: true
    };

    setStageIndicator((current) => {
      if (
        current.left === nextIndicator.left &&
        current.top === nextIndicator.top &&
        current.width === nextIndicator.width &&
        current.height === nextIndicator.height &&
        current.ready === nextIndicator.ready
      ) {
        return current;
      }

      return nextIndicator;
    });
  }, [highlightedStageId, pageEntered, stageMeta]);

  useEffect(() => {
    if (!bootstrapResolved) {
      return;
    }

    const syncIndicator = () => {
      const rail = stageRailRef.current;
      const button = stageButtonRefs.current[highlightedStageId];
      if (!rail || !button) {
        return;
      }

      setStageIndicator({
        left: button.offsetLeft,
        top: button.offsetTop,
        width: button.offsetWidth,
        height: button.offsetHeight,
        ready: true
      });
    };

    syncIndicator();
    window.addEventListener("resize", syncIndicator);
    return () => {
      window.removeEventListener("resize", syncIndicator);
    };
  }, [bootstrapResolved, highlightedStageId]);

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
    options: { attachment?: ComposerAttachment | null; payload?: Record<string, unknown> } = {}
  ) => {
    if (!stored || sending || attachmentProcessing) {
      return;
    }

    let resolvedAttachment = options.attachment ?? null;

    if (!rawMessage.trim() && !resolvedAttachment) {
      return;
    }

    try {
      resolvedAttachment = await resolveAttachmentForSubmission(resolvedAttachment);
    } catch (attachmentError) {
      setComposerError(
        attachmentError instanceof Error ? attachmentError.message : "\u622a\u56fe\u8bc6\u522b\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002"
      );
      return;
    }

    const submission = buildComposerSubmission(rawMessage, resolvedAttachment);

    if (!submission.userMessage.trim()) {
      setComposerError("\u622a\u56fe\u4e2d\u6ca1\u6709\u8bc6\u522b\u5230\u53ef\u7528\u6587\u5b57\uff0c\u8bf7\u6362\u4e00\u5f20\u66f4\u6e05\u6670\u7684\u56fe\u7247\u518d\u8bd5\u3002");
      return;
    }

    const requestedStep = REQUESTED_STEP_BY_STAGE[selectedStageId] ?? detail?.project.currentStep ?? WorkflowStep.TOPIC_NORMALIZE;
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
      setAttachment(null);
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
    }
  };

  useEffect(() => {
    if (!stored || loading || !pendingBootstrapTopic || bootstrapStartedRef.current || sending) {
      return;
    }

    if (messages.length > 0) {
      clearPendingProjectBootstrap(projectId);
      setPendingBootstrapTopic(null);
      setInitializingProject(false);
      return;
    }

    bootstrapStartedRef.current = true;
    clearPendingProjectBootstrap(projectId);

    void (async () => {
      try {
        await streamMessage(pendingBootstrapTopic);
      } finally {
        setPendingBootstrapTopic(null);
        setInitializingProject(false);
      }
    })();
  }, [loading, messages.length, pendingBootstrapTopic, projectId, sending, stored]);

  const confirmTopic = async () => {
    setConfirmProcessing(true);
    setWorkflowProgress({
      currentCount: 1,
      totalCount: 7,
      stageLabel: "\u7814\u7a76\u8bbe\u5b9a",
      remainingMinutes: 5
    });
    setOptimisticStageId("data");
    setSelectedStageId("data");
    await streamMessage("\u786e\u8ba4\u5e76\u751f\u6210");
  };

  const processAttachment = async (file: File) => {
    const normalizedFile = ensureNamedImageFile(file);

    if (normalizedFile.type.startsWith("image/")) {
      setComposerError("");
      setAttachmentStatusText("");
      setAttachment(buildPendingImageAttachment(normalizedFile));
      return;
    }

    try {
      setComposerError("");
      setAttachment(null);
      setAttachmentProcessing(true);
      setAttachmentStatusText("正在解析附件...");
      const nextAttachment = await readComposerAttachment(normalizedFile, {
        onStatus: (statusText) => setAttachmentStatusText(statusText)
      });
      setAttachment(nextAttachment);
    } catch (attachmentError) {
      setAttachment(null);
      setComposerError(
        attachmentError instanceof Error ? attachmentError.message : "文件读取失败，请稍后重试。"
      );
    } finally {
      setAttachmentProcessing(false);
      setAttachmentStatusText("");
    }
  };

  const handleAttachmentPick = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    await processAttachment(file);
  };

  const resolveAttachmentForSubmission = async (nextAttachment: ComposerAttachment | null) => {
    if (!nextAttachment || nextAttachment.source !== "image" || !nextAttachment.file || nextAttachment.processed) {
      return nextAttachment;
    }

    try {
      setComposerError("");
      setAttachmentProcessing(true);
      setAttachmentStatusText("\u6b63\u5728\u8bc6\u522b\u622a\u56fe\u6587\u5b57...");
      return await readImageAttachment(nextAttachment.file, (statusText) => setAttachmentStatusText(statusText));
    } finally {
      setAttachmentProcessing(false);
      setAttachmentStatusText("");
    }
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
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;

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

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey
    ) {
      event.preventDefault();
      void streamMessage(input, { attachment });
    }
  };

  const helperText = showTopicConfirmBar
    ? "如需调整研究设定，可直接补充；如无问题，请点击上方确认主题。"
    : "可以继续追问当前模块，也可以直接修改研究设定。";
  const placeholderText = showTopicConfirmBar
    ? "例如：研究对象改成中国A股上市公司（剔除ST和金融股）\n例如：控制变量补充企业规模、资产负债率、ROA\n例如：固定效应改成企业固定效应和年份固定效应"
    : "例如：请解释一下这一步的代码逻辑\n例如：把控制变量再补充完整一点\n例如：请重写一版更详细的 Stata 代码";

  if (!bootstrapResolved) {
    return <section aria-hidden="true" className="mx-auto max-w-[1100px] px-6 pb-8 pt-6 opacity-0" />;
  }

  if (showInitialProjectLoading) {
    return (
      <WorkspacePlaceholder>
        <ThinkingBubble className="w-fit" />
      </WorkspacePlaceholder>
    );
  }

  if (stored === undefined || loading) {
    return (
      <WorkspacePlaceholder>
        <ThinkingBubble className="w-fit" />
      </WorkspacePlaceholder>
    );
  }

  if (!stored && availableProjects.length === 1) {
    return (
      <WorkspacePlaceholder>
        <ThinkingBubble className="w-fit" />
      </WorkspacePlaceholder>
    );
  }

  if (!stored) {
    return (
      <div className="mx-auto max-w-[1100px] px-6 pb-8 pt-6">
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
      {workflowLockActive ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-slate-950/18 backdrop-blur-[12px]">
          <div className="workflow-lock-edge absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(96,165,250,0.75),rgba(196,181,253,0.9),transparent)]" />
          <div className="workflow-lock-edge absolute inset-x-0 bottom-0 h-px bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.8),rgba(165,180,252,0.92),transparent)]" style={{ animationDelay: "-1.6s" }} />
          <div className="workflow-lock-aura absolute left-[14%] top-[18%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.26),transparent_68%)] blur-3xl" />
          <div className="workflow-lock-aura absolute bottom-[14%] right-[12%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.18),transparent_70%)] blur-3xl" style={{ animationDelay: "-1.8s" }} />
          <div className="workflow-lock-panel relative mx-6 w-full max-w-xl rounded-[28px] border border-white/70 bg-white/82 px-8 py-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.16)] backdrop-blur-xl">
            <div className="mx-auto flex justify-center">
              <ThinkingBubble label={"Tank 正在处理中，请稍等片刻"} />
            </div>
            <p className="mt-4 text-sm font-medium leading-7 text-slate-700">
              {`共 ${workflowLockProgress.totalCount} 个模块，当前已处理 ${workflowLockProgress.currentCount}/${workflowLockProgress.totalCount} 个，预计还需 ${workflowLockProgress.remainingMinutes} 分钟。`}
            </p>
            <p className="mt-2 text-xs font-normal tracking-[0.08em] text-slate-500">
              {`当前正在生成：${workflowLockProgress.stageLabel}`}
            </p>
          </div>
        </div>
      ) : null}

      <section className={clsx(
        "mx-auto max-w-[1100px] space-y-6 px-6 pb-8 pt-6 transition-[opacity,transform] duration-200",
        pageEntered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      )}>
      <div className="border-b border-slate-200 pb-4">
        <div ref={stageRailRef} className="relative flex flex-wrap gap-[10px] sm:gap-3">
          {stageIndicator.ready ? (
            <div
              className="pointer-events-none absolute rounded-full bg-slate-950 shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition-[transform,width,height] duration-300 ease-in-out"
              style={{
                width: stageIndicator.width,
                height: stageIndicator.height,
                transform: `translate(${stageIndicator.left}px, ${stageIndicator.top}px)`
              }}
            />
          ) : null}

          {stageMeta.map((stage, index) => {
            const isHighlighted = highlightedStageId === stage.id;

            return (
              <button
                key={stage.id}
                ref={(node) => {
                  stageButtonRefs.current[stage.id] = node;
                }}
                className={clsx(
                  "interactive-chip relative z-10 inline-flex h-[38px] items-center rounded-full border px-3 text-[13px] font-medium whitespace-nowrap transition-[color,border-color,background-color,transform,box-shadow] duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-slate-200",
                  isHighlighted
                    ? "border-transparent bg-transparent text-white shadow-none"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900",
                  confirmProcessing ? "cursor-default" : ""
                )}
                disabled={confirmProcessing}
                onClick={() => {
                  if (!confirmProcessing) {
                    setSelectedStageId(stage.id);
                  }
                }}
                type="button"
              >
                <span>{`0${index + 1} ${stage.label}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-6">
        {error ? (
          <div className="rounded-[14px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-normal leading-7 text-rose-700">
            {error}
          </div>
        ) : null}

        {selectedStageMessages.length > 0 ? (
          <div className="space-y-0">
            <div className="space-y-6">
              {selectedStageMessages.map((message, index) => (
                <MessageCard
                  key={message.id ?? `${message.messageType}-${message.createdAt ?? index}`}
                  fullWidth
                  message={message}
                  topicConfirmAction={
                    selectedStage.id === "topic" && message.messageType === "topic_confirm" && showTopicConfirmBar
                      ? {
                          hint: "如无问题，请确认主题；如需修改，请点击下方微调。",
                          label: "确认主题",
                          disabled: sending || confirmProcessing,
                          locked: confirmProcessing,
                          onConfirm: () => {
                            void confirmTopic();
                          },
                          onRefineSubmit: async (value: string) => {
                            await streamMessage(value);
                          }
                        }
                      : null
                  }
                />
              ))}
            </div>
          </div>
        ) : showStageLoadingState ? (
          <WorkspaceStageLoadingCard
            description={normalizeDisplayText("已收到确认，Tank 正在生成整套 Stata 工作流，并把结果分别写入上方各个模块。")}
          />
        ) : (
          <div className="rounded-[20px] border border-slate-200 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="text-base font-semibold text-slate-950">
              {selectedStageIsActive ? "这个环节还没有产出内容" : "这个环节暂时没有历史内容"}
            </p>
            <p className="mt-2 text-sm font-normal leading-7 text-slate-600">
              {selectedStageIsActive
                ? "Tank 进入这个环节后，会在这里显示结构化结果。"
                : "点击其他流程块，可以继续回看已经完成的研究环节。"}
            </p>
          </div>
        )}
      </div>

      {showTopicConfirmBar ? null : (
        <div className="surface-hover-lift rounded-[20px] border border-[#e5e7eb] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">

        <p className="mb-3.5 text-sm font-normal leading-[1.6] text-slate-600">{helperText}</p>

        {attachment ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                <FileIcon />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{attachment.name}</p>
                <p className="mt-1 text-xs font-normal text-slate-500">
                  {formatAttachmentSize(attachment.size)}
                  {attachment.source === "image"
                    ? attachment.processed
                      ? " \u00b7 \u56fe\u7247\u6587\u5b57\u5df2\u8bc6\u522b"
                      : " \u00b7 \u53d1\u9001\u540e\u81ea\u52a8\u8bc6\u522b"
                    : attachment.truncated
                      ? " \u00b7 \u5185\u5bb9\u5df2\u622a\u65ad"
                      : " \u00b7 \u5185\u5bb9\u5df2\u5b8c\u6210\u89e3\u6790"}
                </p>
              </div>
            </div>
            <button
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              onClick={() => setAttachment(null)}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        ) : null}

        <textarea
          className="min-h-[120px] w-full resize-y rounded-[14px] border border-slate-200 bg-white px-4 py-3.5 text-sm font-normal leading-[1.7] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300 focus:ring-4 focus:ring-slate-200/60 disabled:cursor-not-allowed disabled:bg-slate-50"
          disabled={sending || confirmProcessing || attachmentProcessing}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleComposerKeyDown}
          onPaste={handleComposerPaste}
          placeholder={placeholderText}
          value={input}
        />

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <input
              accept=".txt,.md,.csv,.json,.log,.yml,.yaml,.xml,.html,.htm,.js,.ts,.tsx,.jsx,.py,.r,.sql,.tex,.do,.pdf,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.bmp,.gif,text/*,image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleAttachmentPick}
              ref={fileInputRef}
              type="file"
            />
            <button
              className="interactive-round inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={sending || confirmProcessing || attachmentProcessing}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              <PlusIcon />
            </button>
            <div className="min-w-0">
              <p className="text-xs font-normal text-slate-400">{"Enter发送，Ctrl+Enter换行"}</p>
              {composerError ? (
                <p className="mt-1 text-xs font-normal text-rose-500">{composerError}</p>
              ) : attachmentProcessing ? (
                <p className="mt-1 text-xs font-normal text-slate-500">{attachmentStatusText || "正在解析附件..."}</p>
              ) : attachment ? (
                <p className="mt-1 truncate text-xs font-normal text-slate-500">
                  {attachment.source === "image"
                    ? `已附加截图 ${attachment.name}`
                    : `已附加 ${attachment.name}，发送后 Tank 会一起读取。`}
                </p>
              ) : listening ? (
                <p className="mt-1 text-xs font-normal text-slate-500">{"\u6b63\u5728\u76d1\u542c\u8bed\u97f3\u8f93\u5165..."}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className={clsx(
                "interactive-round inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60",
                listening
                  ? "border-slate-900 bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.18)]"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              )}
              disabled={sending || confirmProcessing || attachmentProcessing}
              onClick={handleMicClick}
              type="button"
            >
              <MicIcon />
            </button>
            <button
              className={clsx(
                "interactive-chip inline-flex h-10 items-center justify-center rounded-[10px] px-[18px] text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60",
                sending ? "bg-slate-950 hover:bg-slate-950" : "bg-slate-950 hover:bg-[#111827]"
              )}
              disabled={sending || confirmProcessing || attachmentProcessing || (!input.trim() && !attachment)}
              onClick={() => void streamMessage(input, { attachment })}
              type="button"
            >
              {sending ? <ThinkingBubble bare className="text-white" /> : "发送"}
            </button>
          </div>
        </div>
        </div>
      )}
      </section>
    </>
  );
}




















