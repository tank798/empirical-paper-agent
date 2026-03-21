"use client";

import clsx from "clsx";
import type { AssistantMessageEnvelope } from "@empirical/shared";
import {
  normalizeAssistantCopy,
  normalizeDisplayText,
  normalizeRelationshipText,
  normalizeResearchObjectText
} from "../lib/message-display";
import { formatWriteMode, messageTypeMeta, moduleLabelMap, workflowStepMeta } from "../lib/presentation";
import { ThinkingBubble } from "./thinking-bubble";

type MessageCardProps = {
  message: AssistantMessageEnvelope;
  canConfirmTopic?: boolean;
  topicConfirmPending?: boolean;
  onConfirmTopic?: () => void;
  fullWidth?: boolean;
};

function renderJsonList(items: unknown, emptyLabel = "暂无补充内容。") {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="mt-3 text-sm font-normal leading-7 text-slate-500">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm font-normal leading-7 text-slate-700">
      {items.map((item, index) => (
        <li key={`${String(item)}-${index}`}>{normalizeDisplayText(String(item))}</li>
      ))}
    </ul>
  );
}

export function MessageCard({
  message,
  canConfirmTopic = false,
  topicConfirmPending = false,
  onConfirmTopic,
  fullWidth = false
}: MessageCardProps) {
  const json = message.contentJson as Record<string, any>;
  const contentText = normalizeAssistantCopy(message.contentText);
  const isUser = message.role === "user";
  const isSystemNotice = message.messageType === "system_notice";
  const isTopicConfirm = message.messageType === "topic_confirm";
  const isResearchChat = message.messageType === "research_chat";
  const meta = !isUser ? messageTypeMeta[message.messageType] : null;
  const stepLabel = message.step ? workflowStepMeta[message.step]?.short ?? message.step : null;
  const moduleLabel = typeof json.moduleName === "string" ? moduleLabelMap[json.moduleName] ?? json.moduleName : null;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-[18px] rounded-br-[8px] bg-slate-950 px-4 py-3 text-sm font-normal leading-7 text-white shadow-[0_8px_20px_rgba(15,23,42,0.1)]">
          {message.contentText}
        </div>
      </div>
    );
  }

  const setupFields = [
    { label: "解释变量", value: json.independentVariable },
    { label: "被解释变量", value: json.dependentVariable },
    { label: "研究对象", value: normalizeResearchObjectText(json.researchObject) },
    {
      label: "控制变量",
      value: Array.isArray(json.controls) ? json.controls.join("、") : normalizeDisplayText(json.controls)
    },
    { label: "样本区间", value: normalizeDisplayText(json.sampleScope) },
    {
      label: "固定效应",
      value: Array.isArray(json.fixedEffects) ? json.fixedEffects.join("、") : normalizeDisplayText(json.fixedEffects)
    },
    {
      label: "关系类型",
      value: normalizeRelationshipText(json.relationship, json.normalizedTopic)
    }
  ].filter((item) => item.value);

  const card = (
    <article
      className={clsx(
        "rounded-[20px] border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        isTopicConfirm ? "p-7" : "p-5",
        isSystemNotice ? "border-amber-100 bg-amber-50/80" : ""
      )}
    >
      {isTopicConfirm ? (
        <div>
          <div className="mb-5">
            <h3 className="text-base font-semibold text-slate-950">研究设定</h3>
          </div>

          <p className="text-[20px] font-semibold leading-[1.5] text-slate-950">
            {normalizeDisplayText(json.normalizedTopic)}
          </p>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {setupFields.map((item) => (
              <div
                key={item.label}
                className="flex min-h-[80px] flex-col rounded-[14px] border border-[#eef2f7] bg-slate-50 px-4 py-3.5"
              >
                <p className="mb-1.5 text-xs font-normal text-slate-500">{item.label}</p>
                <p className="break-words text-[15px] font-medium leading-[1.5] text-slate-950">{item.value}</p>
              </div>
            ))}
          </div>

          {canConfirmTopic ? (
            <div className="mt-5 flex justify-end">
              <button
                className="inline-flex h-10 items-center justify-center rounded-[10px] bg-slate-950 px-[18px] text-sm font-medium text-white transition hover:bg-[#111827] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={topicConfirmPending}
                onClick={onConfirmTopic}
                type="button"
              >
                {topicConfirmPending ? <ThinkingBubble bare className="text-white" /> : "确认并生成"}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-normal text-slate-600">
              {normalizeDisplayText(meta?.label ?? message.messageType)}
            </span>
            {moduleLabel ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-normal text-slate-500">
                {normalizeDisplayText(moduleLabel)}
              </span>
            ) : null}
            {stepLabel ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-normal text-slate-500">
                {normalizeDisplayText(stepLabel)}
              </span>
            ) : null}
          </div>

          {contentText && !isResearchChat ? (
            <p className="mt-4 whitespace-pre-wrap text-sm font-normal leading-7 text-slate-800">{contentText}</p>
          ) : null}

          {message.messageType === "system_notice" && Array.isArray(json.guidanceOptions) && json.guidanceOptions.length > 0 ? (
            <div className="mt-4 rounded-[14px] border border-white/80 bg-white/90 p-4">
              <p className="text-sm font-medium text-slate-800">
                {typeof json.guidanceTitle === "string" ? normalizeDisplayText(json.guidanceTitle) : "可以直接这样补充"}
              </p>
              {renderJsonList(json.guidanceOptions)}
            </div>
          ) : null}

          {message.messageType === "sop_guide" ? (
            <div className="mt-4 rounded-[14px] border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-normal text-slate-600">推荐起点：{normalizeDisplayText(json.recommendedStart)}</p>
              {renderJsonList(json.steps)}
            </div>
          ) : null}

          {message.messageType === "skill_output" ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">这一环节在做什么</p>
                  <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{normalizeDisplayText(json.purpose)}</p>
                  <p className="mt-4 text-sm font-medium text-slate-800">和当前研究有什么关系</p>
                  <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{normalizeDisplayText(json.meaning)}</p>
                </div>
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">变量与模型</p>
                  {renderJsonList(json.variableDesign)}
                  <p className="mt-4 text-sm font-normal leading-7 text-slate-700">{normalizeDisplayText(json.modelSpec)}</p>
                </div>
              </div>

              {json.stataCode ? (
                <div className="rounded-[14px] bg-slate-950 p-4 text-sm text-slate-100">
                  <p className="mb-3 text-xs font-normal uppercase tracking-[0.18em] text-slate-400">Stata 代码</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap leading-7">{normalizeDisplayText(json.stataCode)}</pre>
                </div>
              ) : null}

              {json.export?.exportCode ? (
                <div className="rounded-[14px] border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">回归表导出</p>
                  <p className="mt-2 font-normal">当前写入模式：{formatWriteMode(json.export.writeMode)}</p>
                  <p className="mt-1 font-normal">目标文件：{normalizeDisplayText(json.export.filePath)}</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6">
                    {normalizeDisplayText(json.export.exportCode)}
                  </pre>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">代码说明</p>
                  {renderJsonList(json.codeExplanation)}
                </div>
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">阅读建议</p>
                  {renderJsonList(json.interpretationGuide || json.checkItems)}
                </div>
              </div>
            </div>
          ) : null}

          {message.messageType === "research_chat" ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="whitespace-pre-wrap text-sm font-normal leading-7 text-slate-800">
                  {contentText || normalizeDisplayText(json.answer)}
                </p>
              </div>

              {Array.isArray(json.keyPoints) && json.keyPoints.length > 0 ? (
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">关键要点</p>
                  {renderJsonList(json.keyPoints)}
                </div>
              ) : null}

              {Array.isArray(json.suggestedNextActions) && json.suggestedNextActions.length > 0 ? (
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">建议下一步</p>
                  {renderJsonList(json.suggestedNextActions)}
                </div>
              ) : null}
            </div>
          ) : null}

          {message.messageType === "result_interpret" ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">通俗解释</p>
                <p className="mt-2 text-sm font-normal leading-7 text-slate-700">
                  {normalizeDisplayText(json.plainExplanation)}
                </p>
              </div>
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">论文写法</p>
                <p className="mt-2 text-sm font-normal leading-7 text-slate-700">
                  {normalizeDisplayText(json.paperStyleExplanation)}
                </p>
              </div>
            </div>
          ) : null}

          {message.messageType === "stata_error_fix" ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">错误解释</p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-normal leading-7 text-slate-700">
                  {normalizeDisplayText(json.explanation)}
                </p>
              </div>
              <div className="rounded-[14px] bg-slate-950 p-4 text-sm text-slate-100">
                <p className="mb-3 text-xs font-normal uppercase tracking-[0.18em] text-slate-400">修复代码</p>
                <pre className="overflow-x-auto whitespace-pre-wrap leading-7">{normalizeDisplayText(json.fixCode)}</pre>
              </div>
            </div>
          ) : null}
        </>
      )}
    </article>
  );

  if (fullWidth) {
    return card;
  }

  return <div className="mx-auto max-w-[920px]">{card}</div>;
}
