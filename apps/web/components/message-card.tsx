"use client";

import clsx from "clsx";
import { useState, type KeyboardEvent } from "react";
import type { AssistantMessageEnvelope } from "@empirical/shared";
import {
  normalizeAssistantCopy,
  normalizeDisplayText,
  normalizeRelationshipText,
  normalizeResearchObjectText
} from "../lib/message-display";
import { formatWriteMode, messageTypeMeta, moduleLabelMap, workflowStepMeta } from "../lib/presentation";

type TopicConfirmAction = {
  hint: string;
  label: string;
  disabled?: boolean;
  locked?: boolean;
  onConfirm: () => void;
  onRefineSubmit?: (value: string) => Promise<void> | void;
};

type MessageCardProps = {
  message: AssistantMessageEnvelope;
  fullWidth?: boolean;
  topicConfirmAction?: TopicConfirmAction | null;
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

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M3.333 8.333 6.4 11.4l6.267-6.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function MessageCard({
  message,
  fullWidth = false,
  topicConfirmAction = null
}: MessageCardProps) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineValue, setRefineValue] = useState("");
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

  const submitInlineRefine = async () => {
    if (!topicConfirmAction?.onRefineSubmit || !refineValue.trim() || topicConfirmAction.disabled) {
      return;
    }

    const nextValue = refineValue.trim();
    setRefineValue("");
    setRefineOpen(false);
    await topicConfirmAction.onRefineSubmit(nextValue);
  };

  const handleRefineKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    void submitInlineRefine();
  };

  const card = (
    <article
      className={clsx(
        "surface-hover-lift rounded-[20px] border border-[#e5e7eb] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        isTopicConfirm ? "p-7" : "p-5",
        isSystemNotice ? "border-amber-100 bg-amber-50/80" : "",
        isTopicConfirm && topicConfirmAction?.locked ? "pointer-events-none opacity-60 saturate-[0.82]" : ""
      )}
    >
      {isTopicConfirm ? (
        <div>
          <div className="mb-5">
            <h3 className="text-base font-semibold text-slate-950">{"研究设定"}</h3>
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

          {topicConfirmAction ? (
            <div className="mt-8 rounded-[20px] border border-white/12 bg-[rgba(15,23,42,0.8)] px-5 py-5 shadow-[0_18px_42px_rgba(15,23,42,0.16)] backdrop-blur-[10px]">
              {topicConfirmAction.onRefineSubmit && !topicConfirmAction.locked ? (
                <div className="mb-4 text-center">
                  <button
                    className="text-xs font-normal tracking-[0.02em] text-slate-400 transition hover:text-slate-200"
                    onClick={() => setRefineOpen((current) => !current)}
                    type="button"
                  >
                    {"内容不准确？点击此处进行微调"}
                  </button>

                  <div
                    className={clsx(
                      "overflow-hidden transition-all duration-300 ease-out",
                      refineOpen ? "mt-3 max-h-24 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="flex items-center gap-2 rounded-[16px] border border-white/10 bg-white/6 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[10px]">
                      <input
                        className="h-10 flex-1 bg-transparent px-2 text-sm font-normal text-white outline-none placeholder:text-slate-400"
                        disabled={topicConfirmAction.disabled}
                        onChange={(event) => setRefineValue(event.target.value)}
                        onKeyDown={handleRefineKeyDown}
                        placeholder={"例如：把研究对象改成中国A股上市公司（剔除ST和金融股）"}
                        value={refineValue}
                      />
                      <button
                        className="inline-flex h-9 items-center justify-center rounded-full border border-white/14 bg-white/8 px-4 text-sm font-medium text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={topicConfirmAction.disabled || !refineValue.trim()}
                        onClick={() => void submitInlineRefine()}
                        type="button"
                      >
                        {"更新"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {!topicConfirmAction.locked ? (
                <div className="topic-confirm-appear topic-confirm-floating">
                  <button
                    className="topic-confirm-surface inline-flex h-[64px] w-full items-center justify-center gap-2.5 rounded-[18px] px-6 text-base font-semibold tracking-[0.08em] text-white transition duration-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={topicConfirmAction.disabled}
                    onClick={topicConfirmAction.onConfirm}
                    type="button"
                  >
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-white/14 bg-white/8 text-white">
                      <CheckIcon />
                    </span>
                    <span>{topicConfirmAction.label}</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {!isSystemNotice ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-normal text-slate-600">
                {normalizeDisplayText(meta?.label ?? message.messageType)}
              </span>
            ) : null}
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
              <p className="text-sm font-normal text-slate-600">{"推荐起点："}{normalizeDisplayText(json.recommendedStart)}</p>
              {renderJsonList(json.steps)}
            </div>
          ) : null}

          {message.messageType === "skill_output" ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"这一环节在做什么"}</p>
                  <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{normalizeDisplayText(json.purpose)}</p>
                  <p className="mt-4 text-sm font-medium text-slate-800">{"和当前研究有什么关系"}</p>
                  <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{normalizeDisplayText(json.meaning)}</p>
                </div>
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"变量与模型"}</p>
                  {renderJsonList(json.variableDesign)}
                  <p className="mt-4 text-sm font-normal leading-7 text-slate-700">{normalizeDisplayText(json.modelSpec)}</p>
                </div>
              </div>

              {json.stataCode ? (
                <div className="rounded-[14px] bg-slate-950 p-4 text-sm text-slate-100">
                  <p className="mb-3 text-xs font-normal uppercase tracking-[0.18em] text-slate-400">{"Stata 代码"}</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap leading-7">{normalizeDisplayText(json.stataCode)}</pre>
                </div>
              ) : null}

              {json.export?.exportCode ? (
                <div className="rounded-[14px] border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">{"回归表导出"}</p>
                  <p className="mt-2 font-normal">{"当前写入模式："}{formatWriteMode(json.export.writeMode)}</p>
                  <p className="mt-1 font-normal">{"目标文件："}{normalizeDisplayText(json.export.filePath)}</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6">
                    {normalizeDisplayText(json.export.exportCode)}
                  </pre>
                </div>
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"代码说明"}</p>
                  {renderJsonList(json.codeExplanation)}
                </div>
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"阅读建议"}</p>
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
                  <p className="text-sm font-medium text-slate-800">{"关键要点"}</p>
                  {renderJsonList(json.keyPoints)}
                </div>
              ) : null}

              {Array.isArray(json.suggestedNextActions) && json.suggestedNextActions.length > 0 ? (
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"建议下一步"}</p>
                  {renderJsonList(json.suggestedNextActions)}
                </div>
              ) : null}
            </div>
          ) : null}

          {message.messageType === "result_interpret" ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">{"通俗解释"}</p>
                <p className="mt-2 text-sm font-normal leading-7 text-slate-700">
                  {normalizeDisplayText(json.plainExplanation)}
                </p>
              </div>
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">{"论文写法"}</p>
                <p className="mt-2 text-sm font-normal leading-7 text-slate-700">
                  {normalizeDisplayText(json.paperStyleExplanation)}
                </p>
              </div>
            </div>
          ) : null}

          {message.messageType === "stata_error_fix" ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">{"错误解释"}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-normal leading-7 text-slate-700">
                  {normalizeDisplayText(json.explanation)}
                </p>
              </div>
              <div className="rounded-[14px] bg-slate-950 p-4 text-sm text-slate-100">
                <p className="mb-3 text-xs font-normal uppercase tracking-[0.18em] text-slate-400">{"修复代码"}</p>
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
