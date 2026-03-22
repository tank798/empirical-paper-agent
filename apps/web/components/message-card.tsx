"use client";

import clsx from "clsx";
import { useState, type KeyboardEvent } from "react";
import type { AssistantMessageEnvelope, TermMapping } from "@empirical/shared";
import {
  normalizeAssistantCopy,
  normalizeDisplayText,
  normalizeRelationshipText,
  normalizeResearchObjectText
} from "../lib/message-display";
import { messageTypeMeta, moduleLabelMap, workflowStepMeta } from "../lib/presentation";
import { StataCodeBlock } from "./stata-code-block";

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

const TERM_CATEGORY_LABELS: Record<TermMapping["category"], string> = {
  independent: "\u89e3\u91ca\u53d8\u91cf",
  dependent: "\u88ab\u89e3\u91ca\u53d8\u91cf",
  control: "\u63a7\u5236\u53d8\u91cf",
  fixed_effect: "\u56fa\u5b9a\u6548\u5e94",
  cluster: "\u805a\u7c7b\u53d8\u91cf",
  panel: "\u9762\u677f id",
  time: "\u65f6\u95f4\u53d8\u91cf"
};

function renderJsonList(items: unknown, emptyLabel = "\u6682\u65e0\u8865\u5145\u5185\u5bb9\u3002") {
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

function isTermMappingArray(value: unknown): value is TermMapping[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === "object");
}

function TermMappingSection({ mappings }: { mappings: TermMapping[] }) {
  if (mappings.length === 0) {
    return null;
  }

  return (
    <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-900">{"\u53d8\u91cf\u540d\u79f0\u4e0e\u82f1\u6587\u7f29\u5199\u5bf9\u7167"}</p>
          <p className="mt-1 text-xs font-normal leading-6 text-slate-500">
            {"\u540e\u7eed Stata \u4ee3\u7801\u5c06\u7edf\u4e00\u4f7f\u7528\u8fd9\u4e00\u5957\u7f29\u5199\u3002"}
          </p>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-[12px] border border-slate-200 bg-white">
        <div className="grid grid-cols-[1.2fr_0.9fr_0.8fr] gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-medium text-slate-500">
          <span>{"\u4e2d\u6587\u540d\u79f0"}</span>
          <span>{"\u82f1\u6587\u7f29\u5199"}</span>
          <span>{"\u7c7b\u522b"}</span>
        </div>
        <div className="divide-y divide-slate-100">
          {mappings.map((mapping) => (
            <div
              key={`${mapping.category}-${mapping.alias}-${mapping.labelCn}`}
              className="grid grid-cols-[1.2fr_0.9fr_0.8fr] gap-4 px-4 py-3 text-sm"
            >
              <span className="break-words font-medium text-slate-900">{normalizeDisplayText(mapping.labelCn)}</span>
              <code className="inline-flex w-fit rounded bg-slate-100 px-2 py-0.5 font-mono text-[13px] text-slate-700">
                {normalizeDisplayText(mapping.alias)}
              </code>
              <span className="text-slate-500">{TERM_CATEGORY_LABELS[mapping.category]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MessageCard({
  message,
  fullWidth = false,
  topicConfirmAction = null
}: MessageCardProps) {
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineValue, setRefineValue] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const json = message.contentJson as Record<string, any>;
  const contentText = normalizeAssistantCopy(message.contentText);
  const isUser = message.role === "user";
  const isSystemNotice = message.messageType === "system_notice";
  const isTopicConfirm = message.messageType === "topic_confirm";
  const isResearchChat = message.messageType === "research_chat";
  const meta = !isUser ? messageTypeMeta[message.messageType] : null;
  const stepLabel = message.step ? workflowStepMeta[message.step]?.short ?? message.step : null;
  const moduleLabel = typeof json.moduleName === "string" ? moduleLabelMap[json.moduleName] ?? json.moduleName : null;
  const termMappings = isTermMappingArray(json.termMappings) ? json.termMappings : [];

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
    { label: "\u89e3\u91ca\u53d8\u91cf", value: json.independentVariable },
    { label: "\u88ab\u89e3\u91ca\u53d8\u91cf", value: json.dependentVariable },
    { label: "\u7814\u7a76\u5bf9\u8c61", value: normalizeResearchObjectText(json.researchObject) },
    {
      label: "\u63a7\u5236\u53d8\u91cf",
      value: Array.isArray(json.controls)
        ? json.controls.map((item: unknown) => normalizeDisplayText(item)).filter(Boolean).join("\u3001")
        : normalizeDisplayText(json.controls)
    },
    { label: "\u6837\u672c\u533a\u95f4", value: normalizeDisplayText(json.sampleScope) },
    {
      label: "\u56fa\u5b9a\u6548\u5e94",
      value: Array.isArray(json.fixedEffects)
        ? json.fixedEffects.map((item: unknown) => normalizeDisplayText(item)).filter(Boolean).join("\u3001")
        : normalizeDisplayText(json.fixedEffects)
    },
    {
      label: "\u5173\u7cfb\u7c7b\u578b",
      value: normalizeRelationshipText(json.relationship, json.normalizedTopic)
    }
  ].filter((item) => item.value);

  const submitInlineRefine = async () => {
    if (!topicConfirmAction?.onRefineSubmit || !refineValue.trim() || topicConfirmAction.disabled || isRefining) {
      return;
    }

    const nextValue = refineValue.trim();
    setRefineValue("");
    setRefineOpen(false);
    setIsRefining(true);

    try {
      await topicConfirmAction.onRefineSubmit(nextValue);
    } finally {
      setIsRefining(false);
    }
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
        isTopicConfirm
          ? "relative overflow-hidden rounded-[20px] border border-[#e5e7eb] bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
          : "surface-hover-lift rounded-[20px] border border-[#e5e7eb] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        isSystemNotice ? "border-amber-100 bg-amber-50/70" : "",
        isTopicConfirm && topicConfirmAction?.locked ? "pointer-events-none opacity-60 saturate-[0.82]" : ""
      )}
    >
      {isTopicConfirm ? (
        <div>
          <div className={clsx("transition-opacity duration-200", isRefining ? "opacity-35" : "opacity-100")}>
            <div className="mb-5">
            <h3 className="text-base font-semibold text-slate-950">{"\u7814\u7a76\u8bbe\u5b9a"}</h3>
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
            <div className="mt-8">
              {topicConfirmAction.onRefineSubmit && !topicConfirmAction.locked ? (
                <div className="mb-4 text-center">
                  <button
                    className="text-xs font-normal tracking-[0.02em] text-slate-400 transition hover:text-slate-600"
                    onClick={() => setRefineOpen((current) => !current)}
                    type="button"
                  >
                    {"\u5185\u5bb9\u4e0d\u51c6\u786e\uff1f\u70b9\u51fb\u6b64\u5904\u8fdb\u884c\u5fae\u8c03"}
                  </button>

                  <div
                    className={clsx(
                      "overflow-hidden transition-all duration-300 ease-out",
                      refineOpen ? "mt-3 max-h-24 opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="mx-auto flex max-w-[680px] items-center gap-2 rounded-[16px] border border-white/10 bg-slate-950/70 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-[10px]">
                      <input
                        className="h-10 flex-1 bg-transparent px-2 text-sm font-normal text-white outline-none placeholder:text-slate-400"
                        disabled={topicConfirmAction.disabled || isRefining}
                        onChange={(event) => setRefineValue(event.target.value)}
                        onKeyDown={handleRefineKeyDown}
                        placeholder={"\u4f8b\u5982\uff1a\u628a\u7814\u7a76\u5bf9\u8c61\u6539\u6210\u4e2d\u56fdA\u80a1\u4e0a\u5e02\u516c\u53f8\uff08\u5254\u9664ST\u548c\u91d1\u878d\u80a1\uff09"}
                        value={refineValue}
                      />
                      <button
                        className="inline-flex h-9 items-center justify-center rounded-full border border-white/14 bg-white/8 px-4 text-sm font-medium text-white transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={topicConfirmAction.disabled || isRefining || !refineValue.trim()}
                        onClick={() => void submitInlineRefine()}
                        type="button"
                      >
                        {"\u66f4\u65b0"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {!topicConfirmAction.locked ? (
                <div className="topic-confirm-appear flex justify-center">
                  <button
                    className="topic-confirm-surface topic-confirm-floating inline-flex h-[54px] w-full max-w-[320px] items-center justify-center rounded-[16px] px-5 text-[15px] font-semibold tracking-[0.08em] text-slate-900 transition duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={topicConfirmAction.disabled || isRefining}
                    onClick={topicConfirmAction.onConfirm}
                    type="button"
                  >
                    <span>{topicConfirmAction.label}</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          </div>

          {isRefining ? (
            <div className="pointer-events-none absolute inset-0 z-20 rounded-[20px] bg-white/58 px-7 py-7 backdrop-blur-[1.5px] transition-opacity duration-200">
              <div className="flex h-full flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div className="skeleton-breathing-bar h-8 w-28 rounded-full" />
                  <div className="skeleton-breathing-bar h-11 w-full max-w-[420px] rounded-[18px]" />
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: Math.max(setupFields.length, 6) }).map((_, index) => (
                      <div key={index} className="rounded-[14px] border border-white/60 bg-white/45 p-4">
                        <div className="skeleton-breathing-bar h-3.5 w-20 rounded-full" />
                        <div className="mt-3 space-y-2">
                          <div className="skeleton-breathing-bar h-4 w-full rounded-full" />
                          <div className="skeleton-breathing-bar h-4 w-2/3 rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="skeleton-breathing-bar h-[54px] w-full max-w-[320px] rounded-[16px]" />
                </div>
              </div>
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

          {contentText && !isResearchChat && message.messageType !== "skill_output" && !isSystemNotice ? (
            <p className="mt-4 whitespace-pre-wrap text-sm font-normal leading-7 text-slate-800">{contentText}</p>
          ) : null}

          {message.messageType === "system_notice" ? (
            <div className="space-y-4">
              {contentText ? (
                <p className="whitespace-pre-wrap text-sm font-normal leading-7 text-slate-800">{contentText}</p>
              ) : null}

              {Array.isArray(json.guidanceOptions) && json.guidanceOptions.length > 0 ? (
                <div className="rounded-[14px] border border-white/80 bg-white/90 p-4">
                  <p className="text-sm font-medium text-slate-800">
                    {typeof json.guidanceTitle === "string"
                      ? normalizeDisplayText(json.guidanceTitle)
                      : "\u53ef\u4ee5\u76f4\u63a5\u8fd9\u6837\u8865\u5145"}
                  </p>
                  {renderJsonList(json.guidanceOptions)}
                </div>
              ) : null}
            </div>
          ) : null}

          {message.messageType === "sop_guide" ? (
            <div className="mt-4 rounded-[14px] border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-normal text-slate-600">
                {"\u63a8\u8350\u8d77\u70b9\uff1a"}
                {normalizeDisplayText(json.recommendedStart)}
              </p>
              {renderJsonList(json.steps)}
            </div>
          ) : null}

          {message.messageType === "skill_output" ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"\u8fd9\u4e00\u73af\u8282\u5728\u505a\u4ec0\u4e48"}</p>
                  <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{normalizeDisplayText(json.purpose)}</p>
                  <p className="mt-4 text-sm font-medium text-slate-800">{"\u548c\u5f53\u524d\u7814\u7a76\u6709\u4ec0\u4e48\u5173\u7cfb"}</p>
                  <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{normalizeDisplayText(json.meaning)}</p>
                </div>
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"\u53d8\u91cf\u4e0e\u6a21\u578b"}</p>
                  {renderJsonList(json.variableDesign)}
                  {json.modelSpec ? (
                    <p className="mt-4 text-sm font-normal leading-7 text-slate-700">{normalizeDisplayText(json.modelSpec)}</p>
                  ) : null}
                </div>
              </div>

              {termMappings.length > 0 ? <TermMappingSection mappings={termMappings} /> : null}

              {json.stataCode ? (
                <StataCodeBlock code={normalizeDisplayText(json.stataCode)} />
              ) : null}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"\u4ee3\u7801\u8bf4\u660e"}</p>
                  {renderJsonList(json.codeExplanation)}
                </div>
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"\u9605\u8bfb\u5efa\u8bae"}</p>
                  {renderJsonList(json.interpretationGuide || json.checkItems)}
                </div>
              </div>
            </div>
          ) : null}

          {isResearchChat ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="whitespace-pre-wrap text-sm font-normal leading-7 text-slate-800">
                  {contentText || normalizeDisplayText(json.answer)}
                </p>
              </div>

              {Array.isArray(json.keyPoints) && json.keyPoints.length > 0 ? (
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"\u5173\u952e\u8981\u70b9"}</p>
                  {renderJsonList(json.keyPoints)}
                </div>
              ) : null}

              {Array.isArray(json.suggestedNextActions) && json.suggestedNextActions.length > 0 ? (
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">{"\u5efa\u8bae\u4e0b\u4e00\u6b65"}</p>
                  {renderJsonList(json.suggestedNextActions)}
                </div>
              ) : null}
            </div>
          ) : null}

          {message.messageType === "result_interpret" ? (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">{"\u901a\u4fd7\u89e3\u91ca"}</p>
                <p className="mt-2 text-sm font-normal leading-7 text-slate-700">
                  {normalizeDisplayText(json.plainExplanation)}
                </p>
              </div>
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">{"\u8bba\u6587\u5199\u6cd5"}</p>
                <p className="mt-2 text-sm font-normal leading-7 text-slate-700">
                  {normalizeDisplayText(json.paperStyleExplanation)}
                </p>
              </div>
            </div>
          ) : null}

          {message.messageType === "stata_error_fix" ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">{"\u9519\u8bef\u89e3\u91ca"}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm font-normal leading-7 text-slate-700">
                  {normalizeDisplayText(json.explanation)}
                </p>
              </div>
              {json.fixCode ? <StataCodeBlock title={"\u4fee\u590d\u4ee3\u7801"} code={normalizeDisplayText(json.fixCode)} /> : null}
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
