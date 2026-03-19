"use client";

import clsx from "clsx";

type ThinkingBubbleState = "thinking" | "done" | "error";

type ThinkingBubbleProps = {
  state?: ThinkingBubbleState;
  label?: string;
  bare?: boolean;
  className?: string;
};

const STATE_LABELS: Record<ThinkingBubbleState, string> = {
  thinking: "Tank正在思考中",
  done: "已完成",
  error: "稍后再试"
};

export function ThinkingBubble({
  state = "thinking",
  label,
  bare = false,
  className
}: ThinkingBubbleProps) {
  const resolvedLabel = label ?? STATE_LABELS[state];
  const isThinking = state === "thinking";

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-3 align-middle",
        isThinking ? "thinking-bubble-motion" : "",
        bare
          ? "min-w-[15ch] justify-start text-inherit"
          : "min-w-[16.5rem] rounded-[18px] bg-[#111111] px-4 py-3 text-white shadow-[0_14px_32px_rgba(15,23,42,0.18)]",
        className
      )}
    >
      <span
        className={clsx(
          "inline-flex h-2.5 w-2.5 shrink-0 rounded-full",
          state === "thinking" ? "bg-white/85 thinking-bubble-spark" : "",
          state === "done" ? "bg-emerald-400" : "",
          state === "error" ? "bg-rose-400" : ""
        )}
      />
      <span className="min-w-0 text-[15px] font-medium tracking-[0.01em]">{resolvedLabel}</span>
      {isThinking ? (
        <span aria-hidden="true" className="inline-flex w-[1.8em] shrink-0 justify-start text-left">
          <span className="thinking-bubble-dot" style={{ animationDelay: "0s" }}>.</span>
          <span className="thinking-bubble-dot" style={{ animationDelay: "0.18s" }}>.</span>
          <span className="thinking-bubble-dot" style={{ animationDelay: "0.36s" }}>.</span>
        </span>
      ) : null}
    </span>
  );
}
