"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";

type StataCodeBlockProps = {
  title?: string;
  code: string;
  className?: string;
};

function ClipboardIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M5.333 3.333A1.333 1.333 0 0 1 6.667 2h2.666a1.333 1.333 0 0 1 1.334 1.333V4h1.333A1.333 1.333 0 0 1 13.333 5.333v7.334A1.333 1.333 0 0 1 12 14H4A1.333 1.333 0 0 1 2.667 12.667V5.333A1.333 1.333 0 0 1 4 4h1.333v-.667Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.35"
      />
      <path
        d="M6.667 4h2.666"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function StataCodeBlock({
  title = "Stata \u4ee3\u7801",
  code,
  className
}: StataCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCopied(false), 1400);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <div
      className={clsx(
        "rounded-[14px] bg-slate-950 p-4 text-sm text-slate-100 shadow-[0_10px_30px_rgba(15,23,42,0.18)]",
        className
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-xs font-normal uppercase tracking-[0.18em] text-slate-400">{title}</p>
        <div className="relative group/copy">
          <button
            aria-label={copied ? "\u5df2\u590d\u5236" : "\u4e00\u952e\u590d\u5236"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-white/8 text-xs font-medium text-white transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-white/20"
            onClick={() => void copyText(code).then(() => setCopied(true))}
            type="button"
          >
            <ClipboardIcon />
            <span className="sr-only">{copied ? "\u5df2\u590d\u5236" : "\u4e00\u952e\u590d\u5236"}</span>
          </button>
          <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 -translate-y-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-[0_8px_20px_rgba(15,23,42,0.28)] transition-all duration-200 group-hover/copy:translate-y-0 group-hover/copy:opacity-100">
            {copied ? "\u5df2\u590d\u5236" : "\u4e00\u952e\u590d\u5236"}
          </div>
        </div>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap leading-7">{code}</pre>
    </div>
  );
}
