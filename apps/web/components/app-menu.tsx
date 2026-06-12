"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getStoredProjects } from "../lib/storage";

function MenuIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 20 20">
      <path d="M4 6h12M4 10h12M4 14h12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 20 20">
      <path
        d="M10 7.2a2.8 2.8 0 1 1 0 5.6 2.8 2.8 0 0 1 0-5.6Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16 10.9a6.3 6.3 0 0 0 0-1.8l1.45-1.12-1.45-2.5-1.78.72a6.2 6.2 0 0 0-1.55-.9L12.4 3.5H7.6l-.27 1.8a6.2 6.2 0 0 0-1.55.9L4 5.48 2.55 7.98 4 9.1a6.3 6.3 0 0 0 0 1.8l-1.45 1.12L4 14.52l1.78-.72a6.2 6.2 0 0 0 1.55.9l.27 1.8h4.8l.27-1.8a6.2 6.2 0 0 0 1.55-.9l1.78.72 1.45-2.5L16 10.9Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function AppMenu() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectCount, setProjectCount] = useState(0);

  useEffect(() => {
    setProjectCount(getStoredProjects().length);
  }, [pathname, open]);

  useEffect(() => {
    setOpen(false);
    setSettingsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpen(false);
      setSettingsOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative z-30">
      <button
        aria-expanded={open}
        aria-label="打开菜单"
        className="interactive-chip inline-flex h-10 items-center justify-center gap-2 rounded-[12px] bg-slate-950 px-3.5 text-sm font-medium text-white transition hover:bg-slate-900"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <MenuIcon />
        <span>菜单</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full mt-2 w-64 rounded-[18px] border border-slate-200 bg-white p-2 text-sm shadow-[0_22px_60px_rgba(15,23,42,0.14)]">
          <Link
            className="block rounded-[12px] px-3 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            href="/projects"
          >
            历史项目
          </Link>
          <Link
            className="block rounded-[12px] px-3 py-2.5 font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            href="/"
          >
            新建项目
          </Link>
          <button
            className="flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
            onClick={() => setSettingsOpen((current) => !current)}
            type="button"
          >
            <span className="inline-flex items-center gap-2">
              <SettingsIcon />
              设置
            </span>
            <span aria-hidden="true" className="text-slate-400">
              {settingsOpen ? "收起" : "展开"}
            </span>
          </button>

          {settingsOpen ? (
            <div className="mx-1 mt-1 rounded-[14px] border border-slate-100 bg-slate-50 px-3 py-3 text-xs leading-6 text-slate-600">
              <p>历史项目：当前本机保存 {projectCount} 个</p>
              <p>输入方式：文本、语音、文件和截图</p>
              <p>AI 助手：通用问答与研究设定补充</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
