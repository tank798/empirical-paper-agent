"use client";

import clsx from "clsx";
import { startTransition, type ChangeEvent, type ClipboardEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { WorkflowStep, type AssistantMessageEnvelope, type ProjectDetail, type ResearchProfile } from "@empirical/shared";
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
import { saveStoredProject, setPendingProjectBootstrap } from "../lib/storage";
import { ChatComposer } from "./chat-composer";
import { FormattedText } from "./formatted-text";
import { ResearchSetupPanel } from "./research-setup-panel";
import { TypingDots } from "./typing-dots";

type HomeSetupSession = {
  projectId: string;
  token: string;
  title: string;
  topic: string;
  detail: ProjectDetail;
  messages: AssistantMessageEnvelope[];
};

type LocalChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: "loading" | "streaming" | "done" | "error" | "stopped";
  messageType?: AssistantMessageEnvelope["messageType"];
  contentJson?: Record<string, unknown>;
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

const AUTO_START_SECONDS = 30;

type SetupCardFieldKey =
  | "normalizedTopic"
  | "independentVariable"
  | "dependentVariable"
  | "researchObject"
  | "sampleScope"
  | "controls"
  | "fixedEffects"
  | "clusterVar";

type SetupCardField = {
  key: SetupCardFieldKey;
  label: string;
  list?: boolean;
  multiline?: boolean;
};

type SetupCardDraft = Record<SetupCardFieldKey, string>;

const SETUP_CARD_FIELDS: SetupCardField[] = [
  { key: "normalizedTopic", label: "研究主题" },
  { key: "independentVariable", label: "解释变量" },
  { key: "dependentVariable", label: "被解释变量" },
  { key: "researchObject", label: "研究对象", multiline: true },
  { key: "sampleScope", label: "样本区间" },
  { key: "controls", label: "控制变量", list: true, multiline: true },
  { key: "fixedEffects", label: "固定效应", list: true },
  { key: "clusterVar", label: "聚类变量" }
];

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

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M8 3.333v9.334M3.333 8h9.334"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
      <path
        d="m4.333 4.333 7.334 7.334M11.667 4.333l-7.334 7.334"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function StopIcon() {
  return <span aria-hidden="true" className="h-3 w-3 rounded-[3px] bg-slate-950" />;
}

const SETUP_STEPS = new Set<string>([WorkflowStep.TOPIC_DETECT, WorkflowStep.TOPIC_NORMALIZE]);

function isSetupAssistantMessage(message: AssistantMessageEnvelope) {
  return (
    message.role !== "user" &&
    SETUP_STEPS.has(String(message.step ?? "")) &&
    (message.messageType === "topic_confirm" || message.messageType === "system_notice")
  );
}

function hasGeneratedWorkflowMessages(messages: AssistantMessageEnvelope[]) {
  return messages.some((message) => message.role !== "user" && !SETUP_STEPS.has(String(message.step ?? "")));
}

const GENERATION_PROGRESS_GROUPS: WorkflowStep[][] = [
  [WorkflowStep.TOPIC_NORMALIZE],
  [WorkflowStep.SOP_GUIDE, WorkflowStep.DATA_CLEANING, WorkflowStep.DATA_CHECK],
  [WorkflowStep.BASELINE_REGRESSION],
  [WorkflowStep.ROBUSTNESS],
  [WorkflowStep.IV],
  [WorkflowStep.MECHANISM],
  [WorkflowStep.HETEROGENEITY]
];

function computeFinalGenerationProgress(detail: ProjectDetail) {
  const statusByStep = new Map(detail.steps.map((step) => [step.step, step.status]));
  const completedCount = GENERATION_PROGRESS_GROUPS.filter((group) => {
    const statuses = group.map((step) => statusByStep.get(step)).filter(Boolean);
    const hasBlockedStep = statuses.some((status) => status === "BLOCKED");

    if (hasBlockedStep) {
      return false;
    }

    if (group.includes(WorkflowStep.SOP_GUIDE)) {
      return statuses.some((status) => status === "COMPLETED");
    }

    return statuses.length === group.length && statuses.every((status) => status === "COMPLETED");
  }).length;

  return Math.round((completedCount / GENERATION_PROGRESS_GROUPS.length) * 100);
}

function hasSetupConversationMessages(messages: AssistantMessageEnvelope[]) {
  return messages.some(
    (message) =>
      message.role !== "user" &&
      SETUP_STEPS.has(String(message.step ?? "")) &&
      (message.messageType === "topic_confirm" || message.messageType === "system_notice" || message.messageType === "research_chat")
  );
}

function getLatestSetupMessage(messages: AssistantMessageEnvelope[]) {
  return [...messages].reverse().find(isSetupAssistantMessage) ?? null;
}

function compactUserMessage(value?: string | null) {
  const text = value?.trim() ?? "";
  if (!text) {
    return "";
  }

  const [head] = text.split("\n\n[附件内容]");
  return (head || text).trim();
}

function assistantMessageText(message: AssistantMessageEnvelope) {
  const json = (message.contentJson ?? {}) as Record<string, unknown>;

  if (message.messageType === "topic_confirm") {
    return (
      message.contentText ||
      (typeof json.assistantMessage === "string" ? json.assistantMessage : "") ||
      "我已整理出完整研究设定，请确认以下内容是否正确。"
    );
  }

  const guidanceOptions = Array.isArray(json.guidanceOptions)
    ? json.guidanceOptions.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const body =
    message.contentText ||
    (typeof json.message === "string" ? json.message : "") ||
    (typeof json.answer === "string" ? json.answer : "");

  return [body, guidanceOptions.length > 0 ? guidanceOptions.map((item) => `- ${item}`).join("\n") : ""]
    .filter(Boolean)
    .join("\n\n");
}

function buildPersistedChatMessages(messages: AssistantMessageEnvelope[]) {
  return messages
    .filter((message) => SETUP_STEPS.has(String(message.step ?? "")))
    .map<LocalChatMessage | null>((message, index) => {
      if (message.role === "user") {
        const text = compactUserMessage(message.contentText);
        return text
          ? {
              id: message.id ?? `user-${index}`,
              role: "user",
              text
            }
          : null;
      }

      const text = assistantMessageText(message);
      return text
        ? {
            id: message.id ?? `assistant-${index}`,
            role: "assistant",
            text,
            messageType: message.messageType,
            contentJson: (message.contentJson ?? {}) as Record<string, unknown>
          }
        : null;
    })
    .filter((message): message is LocalChatMessage => Boolean(message));
}

function shouldStayOnHome(detail: ProjectDetail, messages: AssistantMessageEnvelope[]) {
  return (
    SETUP_STEPS.has(detail.project.currentStep) &&
    hasSetupConversationMessages(messages) &&
    !hasGeneratedWorkflowMessages(messages)
  );
}

async function fetchHydratedProjectSnapshot(projectId: string, token: string) {
  let lastDetail: ProjectDetail | null = null;
  let lastMessages: AssistantMessageEnvelope[] = [];

  for (let attempt = 0; attempt < 18; attempt += 1) {
    const [detail, messages] = await Promise.all([
      apiRequest<ProjectDetail>(`/projects/${projectId}`, { token }),
      apiRequest<AssistantMessageEnvelope[]>(`/projects/${projectId}/messages`, { token })
    ]);

    lastDetail = detail;
    lastMessages = messages;

    const hasRenderableSetup = hasSetupConversationMessages(messages) || hasGeneratedWorkflowMessages(messages);

    if (hasRenderableSetup) {
      return { detail, messages };
    }

    await new Promise((resolve) => window.setTimeout(resolve, 180));
  }

  return {
    detail: lastDetail as ProjectDetail,
    messages: lastMessages
  };
}

function displaySetupValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).join("、");
  }

  return typeof value === "string" ? value.trim() : "";
}

function asSetupRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getSetupCardSource(contentJson: Record<string, unknown> | undefined) {
  const json = contentJson ?? {};
  return {
    ...json,
    ...asSetupRecord(json.currentDraft)
  };
}

function getSetupCardRows(contentJson: Record<string, unknown> | undefined, includeEmpty = false) {
  const source = getSetupCardSource(contentJson);

  return SETUP_CARD_FIELDS
    .map((field) => ({
      ...field,
      value: displaySetupValue(source[field.key])
    }))
    .filter((row) => includeEmpty || row.value);
}

function buildSetupCardDraft(contentJson: Record<string, unknown> | undefined): SetupCardDraft {
  const source = getSetupCardSource(contentJson);
  return SETUP_CARD_FIELDS.reduce<SetupCardDraft>((draft, field) => {
    draft[field.key] = displaySetupValue(source[field.key]);
    return draft;
  }, {} as SetupCardDraft);
}

function splitSetupList(value: string) {
  return value
    .split(/[、,，;；\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProfilePatchFromSetupDraft(draft: SetupCardDraft): Partial<ResearchProfile> {
  return SETUP_CARD_FIELDS.reduce<Partial<ResearchProfile>>((patch, field) => {
    const value = draft[field.key].trim();

    if (!value) {
      return patch;
    }

    if (field.list) {
      return {
        ...patch,
        [field.key]: splitSetupList(value)
      };
    }

    return {
      ...patch,
      [field.key]: value
    };
  }, {});
}

function mergeSetupCardContentJson(contentJson: Record<string, unknown> | undefined, patch: Partial<ResearchProfile>) {
  const json = contentJson ?? {};
  return {
    ...json,
    ...patch,
    currentDraft: {
      ...asSetupRecord(json.currentDraft),
      ...patch
    }
  };
}

function SetupConfirmationCard({
  contentJson,
  editing,
  draftValues,
  secondsRemaining,
  autoStartCancelled,
  disabled,
  saving,
  onDraftChange,
  onEdit,
  onUndo,
  onCancelAutoStart,
  onSave,
  onStart
}: {
  contentJson?: Record<string, unknown>;
  editing: boolean;
  draftValues: SetupCardDraft;
  secondsRemaining: number;
  autoStartCancelled: boolean;
  disabled: boolean;
  saving: boolean;
  onDraftChange: (key: SetupCardFieldKey, value: string) => void;
  onEdit: () => void;
  onUndo: () => void;
  onCancelAutoStart: () => void;
  onSave: () => void | Promise<void>;
  onStart: () => void;
}) {
  const rows = getSetupCardRows(contentJson, editing);

  return (
    <div className="setup-confirm-card mx-auto w-full max-w-[720px] rounded-[22px] border border-[#E5EAF2] bg-white p-6 shadow-[0_18px_46px_rgba(15,23,42,0.08)] sm:p-7">
      <h2 className="text-lg font-semibold text-slate-950">研究设定</h2>
      <div className="mt-5 divide-y divide-slate-100">
        {rows.map((row) => (
          <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4" key={row.key}>
            <p className="text-[13px] font-semibold leading-6 text-[#64748B]">{row.label}</p>
            {editing ? (
              <textarea
                className="min-h-10 w-full resize-y rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium leading-6 text-[#111827] outline-none transition focus:border-slate-400 focus:bg-white"
                disabled={disabled || saving}
                onChange={(event) => onDraftChange(row.key, event.target.value)}
                rows={row.multiline ? 3 : 1}
                value={draftValues[row.key] ?? ""}
              />
            ) : (
              <p className="break-words text-sm font-medium leading-6 text-[#111827]">{row.value}</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] leading-5 text-[#64748B]">
          {editing
            ? "正在编辑，自动开始已暂停"
            : autoStartCancelled
              ? "已取消自动开始"
              : `${secondsRemaining}s 后自动开始`}
        </p>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button
                className="inline-flex h-9 items-center rounded-[10px] border border-[#D8DEE9] bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled || saving}
                onClick={onUndo}
                type="button"
              >
                撤销
              </button>
              <button
                className="inline-flex h-9 items-center rounded-[10px] bg-[#0F172A] px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled || saving}
                onClick={() => void onSave()}
                type="button"
              >
                {saving ? "保存中" : "确认"}
              </button>
            </>
          ) : (
            <>
              <button
                className="inline-flex h-9 items-center rounded-[10px] border border-[#D8DEE9] bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                onClick={onEdit}
                type="button"
              >
                编辑
              </button>
              <button
                className="inline-flex h-9 items-center rounded-[10px] border border-[#D8DEE9] bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                onClick={onCancelAutoStart}
                type="button"
              >
                取消
              </button>
              <button
                className="inline-flex h-9 items-center rounded-[10px] bg-[#0F172A] px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={disabled}
                onClick={onStart}
                type="button"
              >
                开始
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function GenerationStatusMessage({ progress }: { progress: number }) {
  return (
    <div className="flex justify-start">
      <div className="w-full text-[#111827]">
        <p className="mb-1 text-xs font-semibold text-slate-400">Tank</p>
        <div className="inline-flex items-center gap-3 text-[15px] leading-7">
          <span className="inline-flex items-center gap-1">
            正在生成中
            <span className="thinking-bubble-dot">.</span>
            <span className="thinking-bubble-dot" style={{ animationDelay: "0.18s" }}>
              .
            </span>
            <span className="thinking-bubble-dot" style={{ animationDelay: "0.36s" }}>
              .
            </span>
          </span>
          <span className="text-[13px] font-medium text-[#64748B]">{progress}%</span>
        </div>
      </div>
    </div>
  );
}

export function HomeHero() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [attachmentProcessing, setAttachmentProcessing] = useState(false);
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const [error, setError] = useState("");
  const [handoffReady, setHandoffReady] = useState(false);
  const [setupSession, setSetupSession] = useState<HomeSetupSession | null>(null);
  const [localChatMessages, setLocalChatMessages] = useState<LocalChatMessage[]>([]);
  const [setupConfirmEditing, setSetupConfirmEditing] = useState(false);
  const [setupCardDraft, setSetupCardDraft] = useState<SetupCardDraft>(() => buildSetupCardDraft(undefined));
  const [setupCardSaving, setSetupCardSaving] = useState(false);
  const [researchConfirmCardVisible, setResearchConfirmCardVisible] = useState(true);
  const [autoStartRemaining, setAutoStartRemaining] = useState(AUTO_START_SECONDS);
  const [autoStartCancelled, setAutoStartCancelled] = useState(false);
  const [generationInProgress, setGenerationInProgress] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const setupScrollRef = useRef<HTMLDivElement | null>(null);
  const setupConfirmCardRef = useRef<HTMLDivElement | null>(null);
  const setupBottomRef = useRef<HTMLDivElement | null>(null);
  const setupStickToBottomRef = useRef(true);
  const setupCardAutoScrollMessageIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const speechBaseTextRef = useRef("");
  const speechCommittedTextRef = useRef("");
  const speechInterimTextRef = useRef("");
  const keepListeningRef = useRef(false);
  const setupAssistantPlaceholderIdRef = useRef<string | null>(null);

  const latestSetupMessage = setupSession ? getLatestSetupMessage(setupSession.messages) : null;
  const latestSetupMessageId = latestSetupMessage?.id ?? "";
  const researchSettingComplete = latestSetupMessage?.messageType === "topic_confirm";
  const showResearchConfirmCard = Boolean(
    researchSettingComplete &&
      researchConfirmCardVisible &&
      !generationInProgress
  );
  // 研究设定完成后关闭右侧卡片，让聊天区通过 setup-chat-grid 自动拉宽。
  const showRightSetupPanel = !researchSettingComplete;
  const setupChatWide = Boolean(researchSettingComplete);
  const setupChatMessages = setupSession
    ? [...buildPersistedChatMessages(setupSession.messages), ...localChatMessages]
    : localChatMessages;
  const setupChatActive = Boolean(setupSession || localChatMessages.length > 0);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      keepListeningRef.current = false;
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!setupChatActive || !setupStickToBottomRef.current || showResearchConfirmCard) {
      return;
    }

    setupBottomRef.current?.scrollIntoView({ block: "end" });
  }, [generationInProgress, generationProgress, loading, setupChatActive, setupChatMessages, showResearchConfirmCard]);

  useEffect(() => {
    if (!researchSettingComplete || !latestSetupMessageId) {
      return;
    }

    setSetupConfirmEditing(false);
    setSetupCardDraft(buildSetupCardDraft((latestSetupMessage?.contentJson ?? {}) as Record<string, unknown>));
    setResearchConfirmCardVisible(true);
    setAutoStartRemaining(AUTO_START_SECONDS);
    setAutoStartCancelled(false);
    setGenerationInProgress(false);
    setGenerationProgress(0);
  }, [latestSetupMessage, latestSetupMessageId, researchSettingComplete]);

  useEffect(() => {
    if (
      !showResearchConfirmCard ||
      generationInProgress ||
      setupCardAutoScrollMessageIdRef.current === latestSetupMessageId ||
      !setupStickToBottomRef.current
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setupStickToBottomRef.current = false;
      setupCardAutoScrollMessageIdRef.current = latestSetupMessageId;
      setupConfirmCardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 60);

    return () => {
      window.clearTimeout(timer);
    };
  }, [generationInProgress, latestSetupMessageId, showResearchConfirmCard]);

  const handleSetupScroll = () => {
    const element = setupScrollRef.current;
    if (!element) {
      return;
    }

    setupStickToBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  };

  const processAttachment = async (file: File) => {
    const normalizedFile = ensureNamedImageFile(file);

    if (normalizedFile.type.startsWith("image/")) {
      setError("");
      setAttachments((current) => [...current, buildPendingImageAttachment(normalizedFile)]);
      return;
    }

    try {
      setError("");
      setAttachmentProcessing(true);
      const nextAttachment = await readComposerAttachment(normalizedFile, {
        onStatus: () => {}
      });
      setAttachments((current) => [...current, nextAttachment]);
    } catch (attachmentError) {
      setError(attachmentError instanceof Error ? attachmentError.message : "文件读取失败，请稍后重试。");
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
        setError("");
        setAttachmentProcessing(true);
        resolved.push(await readImageAttachment(nextAttachment.file, () => {}));
      } finally {
        setAttachmentProcessing(false);
      }
    }
    return resolved;
  };

  const isAbortError = (value: unknown) => value instanceof DOMException && value.name === "AbortError";

  const stopCurrentRequest = () => {
    // GPT 风格停止按钮直接中止当前 fetch/SSE 请求，finally 中会恢复为发送箭头。
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    const placeholderId = setupAssistantPlaceholderIdRef.current;
    if (placeholderId) {
      setLocalChatMessages((current) =>
        current.flatMap((message) => {
          if (message.id !== placeholderId) {
            return [message];
          }

          return message.text.trim() ? [{ ...message, status: "stopped" as const }] : [];
        })
      );
      setupAssistantPlaceholderIdRef.current = null;
    }
    setLoading(false);
    setGenerationInProgress(false);
  };

  const updateSetupAssistantPlaceholder = (
    assistantMessageId: string | null,
    patch: Partial<Pick<LocalChatMessage, "text" | "status">>
  ) => {
    if (!assistantMessageId) {
      return;
    }

    setLocalChatMessages((current) =>
      current.map((message) =>
        message.id === assistantMessageId
          ? {
              ...message,
              ...patch
            }
          : message
      )
    );
  };

  const finishAndOpenProject = (
    projectId: string,
    token: string,
    title: string,
    submittedTopic: string,
    detail: ProjectDetail,
    messages: AssistantMessageEnvelope[]
  ) => {
    setPendingProjectBootstrap({
      projectId,
      topic: submittedTopic,
      createdAt: Date.now(),
      detail,
      messages
    });

    saveStoredProject({ id: projectId, token, title });
    setAttachments([]);
    setSetupSession(null);
    setLocalChatMessages([]);
    setupAssistantPlaceholderIdRef.current = null;
    setHandoffReady(true);
    window.setTimeout(() => {
      startTransition(() => {
        router.push(`/projects/${projectId}`);
      });
    }, 180);
  };

  const applySetupCardEdits = async () => {
    if (!setupSession || !latestSetupMessage || setupCardSaving) {
      return;
    }

    const profilePatch = buildProfilePatchFromSetupDraft(setupCardDraft);
    setSetupCardSaving(true);
    setError("");

    try {
      const updatedProfile = await apiRequest<ResearchProfile>(`/projects/${setupSession.projectId}/research-profile`, {
        method: "PUT",
        token: setupSession.token,
        body: JSON.stringify(profilePatch)
      });
      const updatedContentJson = mergeSetupCardContentJson(
        (latestSetupMessage.contentJson ?? {}) as Record<string, unknown>,
        profilePatch
      );

      setSetupSession((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          title: typeof profilePatch.normalizedTopic === "string" ? profilePatch.normalizedTopic : current.title,
          detail: {
            ...current.detail,
            researchProfile: updatedProfile
          },
          messages: current.messages.map((message) =>
            message.id === latestSetupMessage.id
              ? {
                  ...message,
                  contentJson: updatedContentJson
                }
              : message
          )
        };
      });
      setSetupConfirmEditing(false);
      setSetupCardDraft(buildSetupCardDraft(updatedContentJson));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "研究设定保存失败，请稍后重试。");
    } finally {
      setSetupCardSaving(false);
    }
  };

  // 新生成流程留在首页聊天流中，替代旧的详情页全屏蒙版进度条。
  const startSetupGeneration = async () => {
    if (!setupSession || generationInProgress) {
      return;
    }

    setAutoStartCancelled(true);
    setResearchConfirmCardVisible(false);
    setSetupConfirmEditing(false);
    setGenerationInProgress(true);
    setGenerationProgress(0);
    setLoading(true);
    setError("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      await streamApiRequest(`/projects/${setupSession.projectId}/workflow/stream`, {
        token: setupSession.token,
        signal: controller.signal,
        body: {
          userMessage: "确认并生成",
          requestedStep: WorkflowStep.TOPIC_NORMALIZE,
          payload: {}
        },
        onEvent: (event) => {
          if (event.type === "progress") {
            const total = Math.max(1, event.progress.totalCount);
            // 百分比绑定后端真实 completedCount / totalCount；失败或重试模块不会被前端假算完成。
            const percent = Math.round((event.progress.currentCount / total) * 100);
            setGenerationProgress(Math.min(100, Math.max(0, percent)));
            return;
          }

          if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      });

      const { detail, messages } = await fetchHydratedProjectSnapshot(setupSession.projectId, setupSession.token);
      const finalProgress = computeFinalGenerationProgress(detail);
      setGenerationProgress(finalProgress);

      if (finalProgress < 100) {
        throw new Error("部分模块生成失败，未达到 100%，请稍后在对应模块中重新生成。");
      }

      // 只有项目步骤状态确认 100% 后才把完整快照交给详情页，避免详情页出现旧生成蒙版。
      window.setTimeout(() => {
        finishAndOpenProject(setupSession.projectId, setupSession.token, setupSession.title, "确认并生成", detail, messages);
      }, 220);
    } catch (requestError) {
      if (!isAbortError(requestError)) {
        setError(requestError instanceof Error ? requestError.message : "生成失败，请稍后重试。");
      }
      setGenerationInProgress(false);
      setResearchConfirmCardVisible(true);
      setLoading(false);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    if (!showResearchConfirmCard || setupConfirmEditing || autoStartCancelled || generationInProgress || loading) {
      return;
    }

    if (autoStartRemaining <= 0) {
      void startSetupGeneration();
      return;
    }

    const timer = window.setTimeout(() => {
      setAutoStartRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoStartCancelled, autoStartRemaining, generationInProgress, loading, setupConfirmEditing, showResearchConfirmCard]);

  const streamSetupMessage = async (
    session: Pick<HomeSetupSession, "projectId" | "token" | "title">,
    submittedTopic: string,
    submission: ReturnType<typeof buildComposerSubmission>,
    assistantMessageId: string | null,
    signal?: AbortSignal
  ) => {
    await streamApiRequest(`/projects/${session.projectId}/workflow/stream`, {
      token: session.token,
      signal,
      body: {
        userMessage: submittedTopic,
        requestedStep: WorkflowStep.TOPIC_NORMALIZE,
        payload: submission.payload
      },
      onEvent: (event) => {
        if (event.type === "status") {
          return;
        }

        if (event.type === "progress") {
          return;
        }

        if (event.type === "message") {
          updateSetupAssistantPlaceholder(assistantMessageId, {
            text: assistantMessageText(event.response.assistantMessage),
            status: "streaming"
          });
          return;
        }

        if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    });

    const { detail, messages } = await fetchHydratedProjectSnapshot(session.projectId, session.token);

    if (shouldStayOnHome(detail, messages)) {
      setSetupSession({
        projectId: session.projectId,
        token: session.token,
        title: session.title,
        topic: submittedTopic,
        detail,
        messages
      });
      setLocalChatMessages([]);
      setupAssistantPlaceholderIdRef.current = null;
      setTopic("");
      setAttachments([]);
      setLoading(false);
      return;
    }

    finishAndOpenProject(session.projectId, session.token, session.title, submittedTopic, detail, messages);
  };

  const submitHomeMessage = async (rawMessage = topic, nextAttachments = attachments) => {
    const nextTopic = rawMessage.trim();
    if ((!nextTopic && nextAttachments.length === 0) || attachmentProcessing) {
      return;
    }

    const userVisibleText = nextTopic || (nextAttachments.length > 0 ? `已上传 ${nextAttachments.map((item) => item.name).join("、")}` : "");
    setTopic("");
    setAttachments([]);
    setupStickToBottomRef.current = true;
    if (researchSettingComplete) {
      setResearchConfirmCardVisible(false);
      setAutoStartCancelled(true);
      setSetupConfirmEditing(false);
      setGenerationInProgress(false);
      setGenerationProgress(0);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let assistantPlaceholderInserted = false;

    try {
      setLoading(true);
      setError("");
      setHandoffReady(false);

      const resolvedAttachments = await resolveAttachmentsForSubmission(nextAttachments);
      const submission = buildComposerSubmission(nextTopic, resolvedAttachments);
      const submittedTopic = submission.userMessage.trim();

      if (!submittedTopic) {
        throw new Error("附件中没有识别到可用文字，请换一个更清晰的文件再试。");
      }

      const localId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const assistantMessageId = `${localId}-assistant`;
      setupAssistantPlaceholderIdRef.current = assistantMessageId;
      setLocalChatMessages((current) => [
        ...current,
        {
          id: `${localId}-user`,
          role: "user",
          text: userVisibleText || submittedTopic
        },
        {
          id: assistantMessageId,
          role: "assistant",
          text: "",
          status: "loading"
        }
      ]);
      assistantPlaceholderInserted = true;

      if (setupSession) {
        await streamSetupMessage(setupSession, submittedTopic, submission, assistantMessageId, controller.signal);
        return;
      }

      const projectTopic = nextTopic || (resolvedAttachments.length > 0 ? `识别附件 ${resolvedAttachments.map((item) => item.name).join("、")}` : submittedTopic);
      const data = await apiRequest<{ project: { id: string; title: string }; resumeToken: string }>("/projects", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({ topicRaw: projectTopic })
      });

      saveStoredProject({ id: data.project.id, token: data.resumeToken, title: data.project.title });
      router.prefetch(`/projects/${data.project.id}`);
      await streamSetupMessage(
        { projectId: data.project.id, token: data.resumeToken, title: data.project.title },
        submittedTopic,
        submission,
        assistantMessageId,
        controller.signal
      );
    } catch (requestError) {
      if (!isAbortError(requestError)) {
        const messageText = requestError instanceof Error ? requestError.message : "生成失败，请稍后重试。";
        if (assistantPlaceholderInserted) {
          updateSetupAssistantPlaceholder(setupAssistantPlaceholderIdRef.current, {
            text: messageText,
            status: "error"
          });
          setupAssistantPlaceholderIdRef.current = null;
        } else {
          setError(messageText);
        }
      }
      setLoading(false);
      setHandoffReady(false);
      setAttachmentProcessing(false);
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleTopicKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      attachmentProcessing ||
      event.nativeEvent.isComposing ||
      event.key !== "Enter" ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    void submitHomeMessage();
  };

  const handleTopicPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
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
    if (loading || attachmentProcessing) {
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
      setError("\u5f53\u524d\u6d4f\u89c8\u5668\u6682\u4e0d\u652f\u6301\u8bed\u97f3\u8f93\u5165\u3002");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    speechBaseTextRef.current = topic.trim();
    speechCommittedTextRef.current = "";
    speechInterimTextRef.current = "";
    setError("");
    setListening(true);
    keepListeningRef.current = true;
    recognitionRef.current = recognition;
    recognition.lang = inferSpeechRecognitionLanguage(topic);
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
      setTopic(
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
        setError(
          event.error === "not-allowed"
            ? "\u8bf7\u5148\u5141\u8bb8\u6d4f\u89c8\u5668\u4f7f\u7528\u9ea6\u514b\u98ce\u3002"
            : event.error === "service-not-allowed"
              ? "\u5f53\u524d\u6d4f\u89c8\u5668\u7981\u6b62\u4e86\u8bed\u97f3\u8bc6\u522b\u670d\u52a1\u3002"
              : event.error === "audio-capture"
                ? "\u6ca1\u6709\u68c0\u6d4b\u5230\u53ef\u7528\u9ea6\u514b\u98ce\u3002"
                : "\u8bed\u97f3\u8bc6\u522b\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002"
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
          setError("\u8bed\u97f3\u8bc6\u522b\u4e2d\u65ad\uff0c\u8bf7\u91cd\u65b0\u5f00\u59cb\u3002");
        }
      }

      setTopic(
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

  if (setupChatActive) {
    return (
      <section
        className={`h-[calc(100vh-5.25rem)] overflow-hidden transition-[opacity,transform,filter] duration-200 ${
          handoffReady ? "translate-y-1 scale-[0.995] opacity-0 blur-[2px]" : "translate-y-0 scale-100 opacity-100 blur-0"
        }`}
      >
        <input
          accept={SUPPORTED_ATTACHMENT_ACCEPT}
          className="hidden"
          multiple
          onChange={handleAttachmentPick}
          ref={fileInputRef}
          type="file"
        />

        <div className="setup-chat-grid h-full min-h-0" data-side-panel={showRightSetupPanel ? "open" : "closed"}>
          <div className="flex min-h-0 flex-col">
              <div
                className="hidden-scrollbar flex-1 overflow-y-auto px-2 pb-6 pt-3 sm:px-5 lg:px-9"
                onScroll={handleSetupScroll}
                ref={setupScrollRef}
              >
              <div
                className={clsx(
                  "mx-auto flex w-full flex-col gap-7 transition-[max-width] duration-[220ms] ease-out",
                  setupChatWide ? "max-w-[940px]" : "max-w-[980px]"
                )}
              >
                {setupChatMessages.map((message) => {
                  if (message.messageType === "topic_confirm") {
                    if (!showResearchConfirmCard) {
                      return null;
                    }

                    return (
                      <div className="flex scroll-mt-8 justify-center" key={message.id} ref={setupConfirmCardRef}>
                        <div className="assistant-message w-full max-w-[760px] break-words text-[15px] leading-7 text-slate-900">
                          <SetupConfirmationCard
                            autoStartCancelled={autoStartCancelled}
                            contentJson={message.contentJson}
                            disabled={loading || generationInProgress}
                            draftValues={setupCardDraft}
                            editing={setupConfirmEditing}
                            onCancelAutoStart={() => setAutoStartCancelled(true)}
                            onDraftChange={(key, value) => {
                              setSetupCardDraft((current) => ({
                                ...current,
                                [key]: value
                              }));
                            }}
                            onEdit={() => {
                              setAutoStartCancelled(true);
                              setSetupCardDraft(buildSetupCardDraft(message.contentJson));
                              setSetupConfirmEditing(true);
                            }}
                            onSave={applySetupCardEdits}
                            onStart={() => {
                              void startSetupGeneration();
                            }}
                            onUndo={() => {
                              setSetupCardDraft(buildSetupCardDraft(message.contentJson));
                              setSetupConfirmEditing(false);
                            }}
                            saving={setupCardSaving}
                            secondsRemaining={autoStartRemaining}
                          />
                        </div>
                      </div>
                    );
                  }

                  return message.role === "user" ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[78%] whitespace-pre-wrap break-words rounded-[22px] bg-slate-100 px-5 py-3 text-[15px] leading-7 text-slate-950">
                        {message.text}
                      </div>
                    </div>
                  ) : (
                    <div key={message.id} className="flex justify-start">
                      <div className="assistant-message max-w-[760px] whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-900">
                        {message.status === "loading" && !message.text ? <TypingDots /> : <FormattedText text={message.text} />}
                      </div>
                    </div>
                  );
                })}

                {generationInProgress ? <GenerationStatusMessage progress={generationProgress} /> : null}

                <div ref={setupBottomRef} />
              </div>
            </div>

            <div
              className={clsx(
                "mx-auto w-full px-2 pb-3 transition-[max-width] duration-[220ms] ease-out sm:px-5 lg:px-9",
                setupChatWide ? "max-w-[940px]" : "max-w-[980px]"
              )}
            >
              <ChatComposer
                attachments={attachments}
                attachmentProcessing={attachmentProcessing}
                disabled={attachmentProcessing}
                error={error}
                listening={listening}
                onAttachClick={() => fileInputRef.current?.click()}
                onChange={setTopic}
                onMicClick={handleMicClick}
                onPaste={handleTopicPaste}
                onRemoveAttachment={(index = 0) =>
                  setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))
                }
                onSend={() => submitHomeMessage()}
                onStop={stopCurrentRequest}
                sending={loading}
                value={topic}
              />
            </div>
          </div>

          <div
            className={clsx(
              "min-w-0 overflow-hidden transition-[opacity,transform] duration-200 ease-out",
              showRightSetupPanel ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-4 opacity-0"
            )}
          >
            {showRightSetupPanel ? (
              <ResearchSetupPanel
                className="self-start"
                confirmDisabled={loading || generationInProgress}
                confirmLoading={false}
                message={latestSetupMessage}
                onConfirm={latestSetupMessage?.messageType === "topic_confirm" ? startSetupGeneration : undefined}
              />
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
    <section
      className={`relative min-h-[calc(100vh-5.25rem)] overflow-hidden rounded-[40px] border border-white/70 px-5 py-8 transition-[opacity,transform,filter] duration-200 sm:px-8 sm:py-10 lg:px-12 lg:py-12 ${
        handoffReady ? "translate-y-1 scale-[0.995] opacity-0 blur-[2px]" : "translate-y-0 scale-100 opacity-100 blur-0"
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(150,193,255,0.28),transparent_24%),radial-gradient(circle_at_84%_16%,rgba(225,240,167,0.34),transparent_22%),radial-gradient(circle_at_50%_68%,rgba(255,255,255,0.92),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-x-[14%] top-10 h-52 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.84),transparent_72%)] blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-12rem)] max-w-[1480px] flex-col items-center justify-center">
        <div className="text-center">
          <h1
            className="mx-auto max-w-full break-words text-[1.65rem] font-black leading-tight text-slate-950 sm:text-[2.15rem] lg:text-[2.85rem]"
            style={{
              fontFamily: `"Arial Rounded MT Bold", "Trebuchet MS", "Aptos", "PingFang SC", "Microsoft YaHei", sans-serif`
            }}
          >
            {"Hi\uff0c\u6211\u662fTank\uff0c\u4f60\u7684\u5b9e\u8bc1\u8bba\u6587\u52a9\u624b"}
          </h1>
        </div>

        <div className="mt-10 w-full max-w-[1180px] rounded-[36px] border border-white/80 bg-white/78 p-4 shadow-[0_30px_90px_rgba(31,41,69,0.12)] backdrop-blur sm:p-5">
          <div className="relative overflow-hidden rounded-[30px] border border-slate-200/80 bg-white/90 px-4 py-4 sm:px-6 sm:py-5">
            <textarea
              className="relative z-20 h-56 w-full resize-none bg-transparent text-lg leading-8 text-slate-900 outline-none sm:h-60 sm:text-[1.06rem]"
              ref={textAreaRef}
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              onKeyDown={handleTopicKeyDown}
              onPaste={handleTopicPaste}
            />
          </div>

          {attachments.length > 0 ? (
            <div className="mt-3 space-y-2">
              {attachments.map((item, index) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  key={`${item.name}-${index}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{item.name}</p>
                  </div>
                  <button
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={loading || attachmentProcessing}
                    onClick={() => setAttachments((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                    type="button"
                  >
                    <CloseIcon />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-end gap-4 px-1">
            <div className="flex items-center gap-2.5">
              <input
                accept={SUPPORTED_ATTACHMENT_ACCEPT}
                className="hidden"
                multiple
                onChange={handleAttachmentPick}
                ref={fileInputRef}
                type="file"
              />
              <button
                aria-label="上传数据字典或字段表"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading || attachmentProcessing}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <PlusIcon />
              </button>

              <button
                aria-label={listening ? "停止语音输入" : "开始语音输入"}
                className={`inline-flex h-11 w-11 items-center justify-center rounded-full border text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  listening
                    ? "border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                }`}
                disabled={loading || attachmentProcessing}
                onClick={handleMicClick}
                type="button"
              >
                <MicIcon />
              </button>

              <button
                aria-label={loading ? "停止生成" : "确认"}
                className={`inline-flex h-11 items-center justify-center rounded-full text-base font-semibold shadow-floating transition disabled:cursor-not-allowed disabled:opacity-55 ${
                  loading
                    ? "w-11 bg-slate-200 text-slate-950 hover:bg-slate-300"
                    : "min-w-[112px] bg-slate-950 px-5 text-white hover:bg-slate-800"
                }`}
                disabled={attachmentProcessing || (!loading && !topic.trim() && attachments.length === 0)}
                onClick={() => {
                  if (loading) {
                    stopCurrentRequest();
                    return;
                  }
                  void submitHomeMessage();
                }}
                type="button"
              >
                {loading ? <StopIcon /> : <span className="w-full text-center">确认</span>}
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
    </>
  );
}
