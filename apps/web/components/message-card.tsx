"use client";

import clsx from "clsx";
import type { AssistantMessageEnvelope } from "@empirical/shared";
import { formatWriteMode, messageTypeMeta, moduleLabelMap, workflowStepMeta } from "../lib/presentation";

function renderJsonList(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">暂无补充内容。</p>;
  }

  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-7 text-slate-700">
      {items.map((item, index) => (
        <li key={`${String(item)}-${index}`}>{String(item)}</li>
      ))}
    </ul>
  );
}

export function MessageCard({ message }: { message: AssistantMessageEnvelope }) {
  const json = message.contentJson as Record<string, any>;
  const isUser = message.role === "user";
  const meta = !isUser ? messageTypeMeta[message.messageType] : null;
  const stepLabel = message.step ? workflowStepMeta[message.step]?.short ?? message.step : null;
  const moduleLabel = typeof json.moduleName === "string" ? moduleLabelMap[json.moduleName] ?? json.moduleName : null;
  const isComingSoon = json.status === "coming_soon";

  if (isUser) {
    return (
      <div className="ml-auto max-w-3xl rounded-[1.5rem] bg-ink px-5 py-4 text-sm leading-8 text-white shadow-card">
        {message.contentText}
      </div>
    );
  }

  return (
    <article
      className={clsx(
        "max-w-4xl rounded-[1.75rem] border p-5 shadow-sm",
        message.messageType === "system_notice"
          ? "border-amber-200 bg-amber-50"
          : "border-slate-200 bg-white/85"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={clsx("text-xs font-semibold uppercase tracking-[0.25em]", meta?.tone)}>
            {meta?.label ?? message.messageType}
          </span>
          {moduleLabel ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{moduleLabel}</span> : null}
        </div>
        {stepLabel ? <span className="text-xs text-slate-400">{stepLabel}</span> : null}
      </div>

      {message.contentText ? <p className="mt-3 text-base leading-8 text-slate-800">{message.contentText}</p> : null}

      {message.messageType === "system_notice" && Array.isArray(json.guidanceOptions) && json.guidanceOptions.length > 0 ? (
        <div className="mt-4 rounded-2xl bg-white/75 p-4">
          <p className="text-sm font-semibold text-slate-700">可参考的研究主题</p>
          {renderJsonList(json.guidanceOptions)}
        </div>
      ) : null}

      {message.messageType === "topic_confirm" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">标准化题目</p>
            <p className="mt-2 text-lg leading-8">{json.normalizedTopic}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
            <p>核心解释变量：{json.independentVariable}</p>
            <p className="mt-2">被解释变量：{json.dependentVariable}</p>
            <p className="mt-2">研究对象：{json.researchObject}</p>
            <p className="mt-2">关系类型：{json.relationship}</p>
          </div>
        </div>
      ) : null}

      {message.messageType === "sop_guide" ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm text-slate-600">推荐起点：{json.recommendedStart}</p>
          {renderJsonList(json.steps)}
        </div>
      ) : null}

      {message.messageType === "skill_output" && isComingSoon ? (
        <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">能力骨架已预留</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">
            {json.message ?? "当前模块已完成接口、目录和 schema 预留，后续阶段会补全真实推理与代码生成能力。"}
          </p>
        </div>
      ) : null}

      {message.messageType === "skill_output" && !isComingSoon ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">本阶段目标</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{json.purpose}</p>
              <p className="mt-4 text-sm font-semibold text-slate-700">与你当前题目的关系</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">{json.meaning}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">变量与模型</p>
              {renderJsonList(json.variableDesign)}
              <p className="mt-4 text-sm leading-7 text-slate-700">{json.modelSpec}</p>
            </div>
          </div>

          {json.stataCode ? (
            <div className="rounded-2xl bg-slate-950 p-4 text-sm text-slate-100">
              <p className="mb-3 text-xs uppercase tracking-[0.25em] text-slate-400">Stata 代码</p>
              <pre className="overflow-x-auto whitespace-pre-wrap leading-7">{json.stataCode}</pre>
            </div>
          ) : null}

          {json.export?.exportCode ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <p className="font-semibold">回归表导出规则</p>
              <p className="mt-2">当前写入模式：{formatWriteMode(json.export.writeMode)}</p>
              <p className="mt-1">目标文件：{json.export.filePath}</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6">{json.export.exportCode}</pre>
            </div>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">代码说明</p>
              {renderJsonList(json.codeExplanation)}
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-700">阅读建议</p>
              {renderJsonList(json.interpretationGuide || json.checkItems)}
            </div>
          </div>
        </div>
      ) : null}

      {message.messageType === "result_interpret" ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">口语化解释</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">{json.plainExplanation}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">论文式表述</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">{json.paperStyleExplanation}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">建议重点关注</p>
            {renderJsonList(json.analysisPoints)}
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">下一步建议</p>
            <p className="mt-2 text-sm leading-7 text-slate-700">{json.nextSuggestion}</p>
            {Array.isArray(json.missingInfo) && json.missingInfo.length > 0 ? (
              <p className="mt-3 text-sm leading-7 text-amber-700">仍建议补充：{json.missingInfo.join("、")}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {message.messageType === "stata_error_fix" ? (
        <div className="mt-4 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm text-slate-700">错误类型：{json.errorType}</p>
          <p className="mt-2 text-sm leading-7 text-slate-700">{json.explanation}</p>
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {json.fixCode}
          </pre>
          <p className="mt-3 text-sm leading-7 text-slate-700">{json.retryMessage}</p>
        </div>
      ) : null}
    </article>
  );
}
