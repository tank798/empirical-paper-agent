"use client";

import clsx from "clsx";

export function TypingDots({ className }: { className?: string }) {
  return (
    <span aria-label="AI 正在生成" className={clsx("typing-dots", className)} role="status">
      <span />
      <span />
      <span />
    </span>
  );
}
