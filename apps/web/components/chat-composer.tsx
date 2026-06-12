"use client";

import clsx from "clsx";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useRef
} from "react";
import type { ComposerAttachment } from "../lib/attachments";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void | Promise<void>;
  onStop?: () => void;
  onAttachClick: () => void;
  onMicClick: () => void;
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  attachment?: ComposerAttachment | null;
  onRemoveAttachment?: () => void;
  disabled?: boolean;
  sending?: boolean;
  attachmentProcessing?: boolean;
  listening?: boolean;
  error?: string;
  className?: string;
  minHeight?: number;
  maxHeight?: number;
  leftAccessory?: ReactNode;
  placeholder?: string;
  variant?: "default" | "assistantDrawer";
};

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
      <path d="M10 4.5v11M4.5 10h11" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
      <path
        d="M10 3.5A2.5 2.5 0 0 0 7.5 6v3.4a2.5 2.5 0 0 0 5 0V6A2.5 2.5 0 0 0 10 3.5Z"
        stroke="currentColor"
        strokeWidth="1.55"
      />
      <path
        d="M5.75 8.9a4.25 4.25 0 0 0 8.5 0M10 13.4v3.1M7.6 16.5h4.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.55"
      />
    </svg>
  );
}

function ArrowUpIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
      <path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function StopIcon() {
  return <span aria-hidden="true" className="h-3 w-3 rounded-[3px] bg-slate-950" />;
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" viewBox="0 0 16 16">
      <path d="m4 4 8 8M12 4 4 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  onAttachClick,
  onMicClick,
  onPaste,
  attachment = null,
  onRemoveAttachment,
  disabled = false,
  sending = false,
  attachmentProcessing = false,
  listening = false,
  error = "",
  className,
  minHeight = 74,
  maxHeight = 220,
  leftAccessory = null,
  placeholder = "",
  variant = "default"
}: ChatComposerProps) {
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const inputLocked = disabled || sending || attachmentProcessing;
  const actionLocked = disabled || attachmentProcessing;
  const drawerVariant = variant === "assistantDrawer";

  useLayoutEffect(() => {
    const element = textAreaRef.current;
    if (!element) {
      return;
    }

    element.style.height = "auto";
    element.style.height = `${Math.max(minHeight, Math.min(element.scrollHeight, maxHeight))}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [maxHeight, minHeight, value]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
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
    if (!inputLocked && (value.trim() || attachment)) {
      void onSend();
    }
  };

  return (
    <div className={clsx("w-full", className)}>
      <div
        className={clsx(
          drawerVariant
            ? "rounded-[20px] border border-[#E5EAF2] bg-white px-3 py-2 shadow-none"
            : "rounded-[30px] border border-slate-200/85 bg-white px-4 py-3 shadow-[0_18px_60px_rgba(15,23,42,0.10),0_2px_10px_rgba(15,23,42,0.04)]"
        )}
      >
        {attachment ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="min-w-0 truncate text-sm font-medium text-slate-800">{attachment.name}</p>
            <button
              aria-label="移除附件"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={inputLocked}
              onClick={onRemoveAttachment}
              type="button"
            >
              <CloseIcon />
            </button>
          </div>
        ) : null}

        <textarea
          className={clsx(
            "hidden-scrollbar block w-full resize-y bg-transparent px-3 py-2 text-[16px] leading-7 text-slate-950 outline-none placeholder:text-slate-400",
            drawerVariant ? "text-[15px] leading-6" : ""
          )}
          disabled={inputLocked}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          ref={textAreaRef}
          value={value}
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              aria-label="上传文件"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={inputLocked}
              onClick={onAttachClick}
              type="button"
            >
              <PlusIcon />
            </button>
            {leftAccessory}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              aria-label={listening ? "停止语音输入" : "开始语音输入"}
              className={clsx(
                "inline-flex h-10 w-10 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-45",
                listening ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
              )}
              disabled={inputLocked}
              onClick={onMicClick}
              type="button"
            >
              <MicIcon />
            </button>

            <button
              aria-label={sending ? "停止生成" : "发送"}
              className={clsx(
                "inline-flex h-11 w-11 items-center justify-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-45",
                sending
                  ? "bg-slate-200 text-slate-950 hover:bg-slate-300"
                  : drawerVariant
                    ? "bg-[#EEF2FF] text-[#1E3A8A] hover:bg-[#E0E7FF]"
                    : "bg-slate-950 text-white hover:bg-slate-800"
              )}
              disabled={sending ? actionLocked : actionLocked || (!value.trim() && !attachment)}
              onClick={() => {
                if (sending) {
                  onStop?.();
                  return;
                }
                void onSend();
              }}
              type="button"
            >
              {sending ? <StopIcon /> : <ArrowUpIcon />}
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="mt-2 px-2 text-xs text-rose-500">{error}</p> : null}
    </div>
  );
}
