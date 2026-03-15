"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AssistantMessageEnvelope, ProjectDetail } from "@empirical/shared";
import { apiRequest } from "../lib/api";
import {
  formatDateTime,
  formatWriteMode,
  getFutureSteps,
  getStepProgress,
  quickActionMap,
  stepStatusMeta,
  workflowStepMeta
} from "../lib/presentation";
import { getStoredProject } from "../lib/storage";
import { MessageCard } from "./message-card";

function displayValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join("、") : "待补充";
  }

  return value && value.trim() ? value : "待补充";
}

export function ResearchWorkspace({ projectId }: { projectId: string }) {
  const stored = useMemo(() => getStoredProject(projectId), [projectId]);
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [messages, setMessages] = useState<AssistantMessageEnvelope[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!stored) {
        setLoading(false);
        return;
      }

      try {
        const [detailData, messageData] = await Promise.all([
          apiRequest<ProjectDetail>(`/projects/${projectId}`, { token: stored.token }),
          apiRequest<AssistantMessageEnvelope[]>(`/projects/${projectId}/messages`, { token: stored.token })
        ]);
        setDetail(detailData);
        setMessages(messageData);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "加载项目失败，请稍后重试。");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [projectId, stored]);

  const currentStep = detail?.project.currentStep;
  const currentStepMeta = currentStep ? workflowStepMeta[currentStep] : null;
  const quickActions = currentStep ? quickActionMap[currentStep] ?? [] : [];
  const progress = getStepProgress(detail?.steps);
  const futureSteps = getFutureSteps(detail?.steps);

  const sendMessage = async (message: string) => {
    if (!stored || !message.trim()) {
      return;
    }

    try {
      setSending(true);
      setError("");
      const response = await apiRequest<{
        projectId: string;
        currentStep: string;
        assistantMessage: AssistantMessageEnvelope;
      }>(`/projects/${projectId}/workflow/next`, {
        method: "POST",
        token: stored.token,
        body: JSON.stringify({ userMessage: message, payload: {} })
      });
      const userMessage: AssistantMessageEnvelope = {
        role: "user",
        messageType: "system_notice",
        step: detail?.project.currentStep ?? null,
        contentText: message,
        contentJson: { userMessage: message },
        createdAt: new Date().toISOString()
      };
      setMessages((current) => [...current, userMessage, response.assistantMessage]);
      const nextDetail = await apiRequest<ProjectDetail>(`/projects/${projectId}`, { token: stored.token });
      setDetail(nextDetail);
      setInput("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "发送失败，请稍后重试。");
    } finally {
      setSending(false);
    }
  };

  if (!stored) {
    return (
      <div className="glass-panel rounded-[28px] border border-dashed border-slate-300 p-8 text-slate-700 shadow-card">
        当前浏览器没有这个项目的恢复令牌，因此无法继续编辑。请回到项目库，使用同一浏览器打开已保存的项目。
      </div>
    );
  }

  if (loading) {
    return <div className="glass-panel rounded-[28px] p-8 shadow-card">正在加载项目...</div>;
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      <aside className="space-y-5 xl:sticky xl:top-4 xl:h-fit">
        <div className="glass-panel surface-outline rounded-[30px] border border-white/80 p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">项目概览</p>
          <h1 className="mt-3 text-2xl leading-10 text-slate-950">{detail?.project.topicNormalized || detail?.project.topicRaw}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-600">当前阶段：{currentStepMeta?.label ?? "待识别"}</p>
          <p className="mt-1 text-sm leading-7 text-slate-600">最近更新：{formatDateTime(detail?.project.updatedAt)}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            <Link className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 font-semibold text-slate-700 transition hover:bg-white" href="/projects">
              返回项目库
            </Link>
            <Link className="rounded-full border border-slate-300 bg-white/80 px-4 py-2 font-semibold text-slate-700 transition hover:bg-white" href={`/projects/${projectId}/export`}>
              导出中心
            </Link>
          </div>
        </div>

        <div className="glass-panel surface-outline rounded-[30px] border border-white/80 p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">研究设定</p>
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs text-slate-500">baseline 优先读取</span>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-7 text-slate-700">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">解释变量</p>
              <p>{displayValue(detail?.researchProfile?.independentVariable)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">被解释变量</p>
              <p>{displayValue(detail?.researchProfile?.dependentVariable)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">控制变量</p>
              <p>{displayValue(detail?.researchProfile?.controls)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">固定效应</p>
              <p>{displayValue(detail?.researchProfile?.fixedEffects)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">聚类变量</p>
              <p>{displayValue(detail?.researchProfile?.clusterVar)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">样本范围</p>
              <p>{displayValue(detail?.researchProfile?.sampleScope)}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel surface-outline rounded-[30px] border border-white/80 p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">导出状态</p>
          <div className="mt-4 space-y-2 text-sm leading-7 text-slate-700">
            <p>默认文件：{displayValue(detail?.exportState?.defaultExportFileName)}</p>
            <p>默认路径：{displayValue(detail?.exportState?.defaultExportPath)}</p>
            <p>下一次写入：{formatWriteMode(detail?.exportState?.nextWriteMode)}</p>
            <p>最近更新：{formatDateTime(detail?.exportState?.updatedAt)}</p>
          </div>
        </div>
      </aside>

      <div className="glass-panel surface-outline rounded-[32px] border border-white/80 p-4 shadow-card sm:p-5 lg:p-6">
        <div className="rounded-[28px] border border-white/80 bg-white/72 p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">研究对话工作台</p>
              <h2 className="mt-2 text-3xl leading-tight text-slate-950">{currentStepMeta?.label ?? "研究流程"}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{currentStepMeta?.description}</p>
            </div>
            <div className="rounded-[20px] bg-slate-950 px-4 py-3 text-sm text-white shadow-floating">
              已完成 {progress.completed} / {progress.total} 个 MVP 阶段
            </div>
          </div>

          <div className="mt-5 h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-accent transition-all" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>

        <div className="mt-5 rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.85),rgba(246,249,255,0.72))] p-4 shadow-sm sm:p-5">
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/72 p-8 text-sm leading-7 text-slate-600">
                这里会按消息流展示主题确认、SOP 指引、代码生成、结果解读和报错修复卡片。
              </div>
            ) : (
              messages.map((message, index) => (
                <MessageCard key={`${message.messageType}-${message.createdAt ?? index}`} message={message} />
              ))
            )}
          </div>
        </div>

        <div className="mt-5 rounded-[30px] border border-white/80 bg-white/86 p-4 shadow-floating sm:p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            {quickActions.map((prompt) => (
              <button
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 transition hover:border-slate-300 hover:bg-white"
                key={prompt.label}
                onClick={() => setInput(prompt.value)}
                type="button"
              >
                {prompt.label}
              </button>
            ))}
          </div>

          <textarea
            className="h-36 w-full resize-none rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fbfdff)] p-4 text-[15px] leading-7 outline-none placeholder:text-slate-400"
            placeholder="继续推进当前步骤，或直接粘贴回归结果、Stata 报错、变量补充说明。"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs leading-6 text-slate-500">
              支持直接粘贴回归结果做解释，也支持粘贴 Stata 报错做修复建议。
            </p>
            <button
              className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-floating transition hover:bg-slate-800 disabled:opacity-60"
              disabled={sending || !input.trim()}
              onClick={() => void sendMessage(input)}
              type="button"
            >
              {sending ? "正在发送..." : "发送到当前步骤"}
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>

      <aside className="space-y-5 xl:sticky xl:top-4 xl:h-fit">
        <div className="glass-panel surface-outline rounded-[30px] border border-white/80 p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">流程进度</p>
          <div className="mt-4 space-y-3">
            {detail?.steps.map((step) => {
              const stepMeta = workflowStepMeta[step.step];
              const statusMeta = stepStatusMeta[step.status];
              return (
                <div className="rounded-[22px] border border-white/80 bg-white/76 p-4" key={step.step}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">{stepMeta.label}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.tone}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{stepMeta.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel surface-outline rounded-[30px] border border-white/80 p-5 shadow-card">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">后续模块骨架</p>
          <div className="mt-4 space-y-3">
            {futureSteps.map((step) => (
              <div className="rounded-[22px] border border-dashed border-slate-300 bg-white/70 p-4" key={step.step}>
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
