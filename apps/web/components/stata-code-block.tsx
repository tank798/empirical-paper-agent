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

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path d="m3.5 8.2 2.7 2.7 6.3-6.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" />
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

const STATA_KEYWORDS = new Set([
  "areg",
  "bysort",
  "collapse",
  "drop",
  "encode",
  "esttab",
  "eststo",
  "foreach",
  "gen",
  "global",
  "if",
  "import",
  "in",
  "keep",
  "local",
  "merge",
  "outreg2",
  "reghdfe",
  "reg",
  "replace",
  "sort",
  "summarize",
  "winsor2",
  "xtreg"
]);

function renderHighlightedLine(line: string, lineIndex: number) {
  const parts = line.split(/(\s+|\/\/.*$|"[^"]*"|'[^']*'|\b[0-9]+(?:\.[0-9]+)?\b|\b[a-zA-Z_][\w.]*\b)/g);

  return (
    <span key={`line-${lineIndex}`}>
      {parts.map((part, index) => {
        if (!part) {
          return null;
        }

        if (/^\/\/.*$/.test(part) || /^\*/.test(part.trim())) {
          return (
            <span key={index} className="text-slate-500">
              {part}
            </span>
          );
        }

        if (/^["'].*["']$/.test(part)) {
          return (
            <span key={index} className="text-emerald-200">
              {part}
            </span>
          );
        }

        if (/^[0-9]+(?:\.[0-9]+)?$/.test(part)) {
          return (
            <span key={index} className="text-sky-200">
              {part}
            </span>
          );
        }

        if (STATA_KEYWORDS.has(part.toLowerCase())) {
          return (
            <span key={index} className="font-semibold text-indigo-200">
              {part}
            </span>
          );
        }

        return <span key={index}>{part}</span>;
      })}
      {"\n"}
    </span>
  );
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
        "rounded-[16px] border border-slate-800 bg-slate-950 p-4 text-sm text-slate-100 shadow-[0_12px_34px_rgba(15,23,42,0.18)]",
        className
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-[0.08em] text-slate-400">{title}</p>
        <button
          aria-label={copied ? "已复制" : "复制代码"}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/12 bg-white/8 px-3 text-xs font-medium text-white transition hover:bg-white/12 focus:outline-none focus:ring-2 focus:ring-white/20"
          onClick={() =>
            void copyText(code)
              .then(() => setCopied(true))
              .catch(() => setCopied(false))
          }
          type="button"
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />}
          <span>{copied ? "已复制" : "复制代码"}</span>
        </button>
      </div>
      <pre className="hidden-scrollbar max-h-[360px] overflow-auto whitespace-pre-wrap font-mono text-[13px] leading-6 text-slate-100">
        <code>{code.split("\n").map(renderHighlightedLine)}</code>
      </pre>
    </div>
  );
}
