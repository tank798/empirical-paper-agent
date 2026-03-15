"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ProjectDetail, ProjectExportState, ProjectStep } from "@empirical/shared";
import { apiRequest } from "../lib/api";
import { exportCards, formatDateTime, formatWriteMode, workflowStepMeta } from "../lib/presentation";
import { getStoredProject } from "../lib/storage";

export function ExportPanel({ projectId }: { projectId: string }) {
  const stored = useMemo(() => getStoredProject(projectId), [projectId]);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [exportState, setExportState] = useState<ProjectExportState | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!stored) {
        setLoading(false);
        return;
      }

      try {
        const [detailData, exportStateData] = await Promise.all([
          apiRequest<ProjectDetail>(`/projects/${projectId}`, { token: stored.token }),
          apiRequest<ProjectExportState>(`/projects/${projectId}/export-state`, { token: stored.token })
        ]);
        setDetail(detailData);
        setExportState(exportStateData);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "加载导出中心失败，请稍后重试。");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [projectId, stored]);

  const requestExport = async (type: string) => {
    if (!stored) {
      return;
    }

    try {
      setSubmitting(type);
      setFeedback("");
      setError("");
      const response = await apiRequest<{ status: string; type: string; message: string }>(
        `/projects/${projectId}/exports`,
        {
          method: "POST",
          token: stored.token,
          body: JSON.stringify({ type })
        }
      );
      setFeedback(response.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "导出接口调用失败，请稍后重试。");
    } finally {
      setSubmitting(null);
    }
  };

  if (!stored) {
    return (
      <section className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-8 text-slate-700">
        当前浏览器没有这个项目的恢复令牌，因此无法打开导出中心。请返回项目库，从同一浏览器继续研究。
      </section>
    );
  }

  if (loading) {
    return <section className="rounded-[2rem] bg-white/70 p-8">正在加载导出中心...</section>;
  }

  const futureSteps = (detail?.steps ?? []).filter(
    (step: ProjectStep) => workflowStepMeta[step.step].phase === "future"
  );

  return (
    <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="space-y-6 rounded-[2rem] border border-white/70 bg-[var(--card)] p-8 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">导出中心</p>
            <h1 className="mt-3 text-3xl">{detail?.project.topicNormalized || detail?.project.topicRaw}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
              当前已经保存了回归导出状态。后续可以在这里接入 Word、Markdown、Stata 代码包和变量设计说明的真实文件生成能力。
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm">
            <Link className="font-semibold text-rust" href={`/projects/${projectId}`}>
              返回研究工作区
            </Link>
            <Link className="font-semibold text-slate-700" href="/projects">
              返回项目库
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-5">
            <p className="text-sm font-semibold text-slate-700">当前回归表导出状态</p>
            <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
              <p>默认文件名：{exportState?.defaultExportFileName ?? "待生成"}</p>
              <p>默认路径：{exportState?.defaultExportPath ?? "待生成"}</p>
              <p>下一次写入：{formatWriteMode(exportState?.nextWriteMode)}</p>
              <p>最后更新时间：{formatDateTime(exportState?.updatedAt)}</p>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-5">
            <p className="text-sm font-semibold text-slate-700">导出规则</p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700">
              <li>第一张回归表默认使用 replace。</li>
              <li>后续回归表默认使用 append。</li>
              <li>如果用户切换新的导出文件路径，将重新从 replace 开始。</li>
              <li>导出中心目前已接通接口，真实文件生成将在后续阶段补全。</li>
            </ul>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {exportCards.map((card) => (
            <div className="rounded-[1.75rem] border border-slate-200 bg-white/80 p-5" key={card.type}>
              <p className="text-lg font-semibold text-slate-900">{card.title}</p>
              <p className="mt-2 text-sm leading-7 text-slate-600">{card.description}</p>
              <button
                className="mt-5 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-60"
                disabled={submitting !== null}
                onClick={() => void requestExport(card.type)}
                type="button"
              >
                {submitting === card.type ? "正在请求接口..." : "调用预留导出接口"}
              </button>
            </div>
          ))}
        </div>

        {feedback ? (
          <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-7 text-emerald-800">
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-800">
            {error}
          </div>
        ) : null}
      </div>

      <aside className="space-y-6">
        <div className="rounded-[2rem] border border-white/70 bg-[var(--card)] p-6 shadow-card">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">后续模块</p>
          <div className="mt-4 space-y-3">
            {futureSteps.map((step) => (
              <div className="rounded-[1.4rem] border border-dashed border-slate-300 bg-white/70 p-4" key={step.step}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">{workflowStepMeta[step.step].label}</p>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">已预留</span>
                </div>
                <p className="mt-2 text-xs leading-6 text-slate-500">{workflowStepMeta[step.step].description}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
}
