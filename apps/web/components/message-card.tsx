"use client";

import clsx from "clsx";
import type { AssistantMessageEnvelope } from "@empirical/shared";
import { normalizeAssistantCopy, normalizeDisplayText, normalizeRelationshipText, normalizeResearchObjectText } from "../lib/message-display";
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

function AgentAvatar() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#0f172a_0%,#1e293b_58%,#4f63ff_100%)] text-xs font-semibold text-white shadow-[0_10px_24px_rgba(37,47,75,0.12)]">
      T
    </div>
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
  const isComingSoon = json.status === "coming_soon";

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-[18px] rounded-br-[8px] bg-slate-950 px-4 py-3 text-sm font-normal leading-7 text-white shadow-[0_8px_20px_rgba(15,23,42,0.1)]">
          {message.contentText}
        </div>
      </div>
    );
  }

  const topicFields = [
    { label: "核心解释变量", value: json.independentVariable },
    { label: "被解释变量", value: json.dependentVariable },
    { label: "研究对象", value: normalizeResearchObjectText(json.researchObject) },
    { label: "\u5173\u7cfb\u7c7b\u578b", value: normalizeRelationshipText(json.relationship, json.normalizedTopic) }
  ];

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

          <p className="text-[20px] font-semibold leading-[1.5] text-slate-950">{normalizeDisplayText(json.normalizedTopic)}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            {topicFields.map((item) => (
              <div
                key={item.label}
                className="flex min-h-[80px] flex-col rounded-[14px] border border-[#eef2f7] bg-slate-50 px-4 py-3.5"
              >
                <p className="mb-1.5 text-xs font-normal text-slate-500">{item.label}</p>
                <p className="break-words text-[15px] font-medium leading-[1.4] text-slate-950">{item.value}</p>
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
                {topicConfirmPending ? <ThinkingBubble bare className="text-white" /> : "\u786e\u8ba4\u4e3b\u9898 \u2192"}
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
            {moduleLabel ? <span className="rounded-full bg-slate-100 px-2.5 py-1 font-normal text-slate-500">{normalizeDisplayText(moduleLabel)}</span> : null}
            {stepLabel ? <span className="rounded-full bg-slate-100 px-2.5 py-1 font-normal text-slate-500">{normalizeDisplayText(stepLabel)}</span> : null}
          </div>

          {contentText && !isResearchChat ? <p className="mt-4 whitespace-pre-wrap text-sm font-normal leading-7 text-slate-800">{contentText}</p> : null}

          {message.messageType === "system_notice" && Array.isArray(json.guidanceOptions) && json.guidanceOptions.length > 0 ? (
            <div className="mt-4 rounded-[14px] border border-white/80 bg-white/90 p-4">
              <p className="text-sm font-medium text-slate-800">{typeof json.guidanceTitle === "string" ? normalizeDisplayText(json.guidanceTitle) : "\u53ef\u53c2\u8003\u7684\u7814\u7a76\u4e3b\u9898"}</p>
              {renderJsonList(json.guidanceOptions)}
            </div>
          ) : null}

          {message.messageType === "sop_guide" ? (
            <div className="mt-4 rounded-[14px] border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-normal text-slate-600">推荐起点：{json.recommendedStart}</p>
              {renderJsonList(json.steps)}
            </div>
          ) : null}

          {message.messageType === "skill_output" && isComingSoon ? (
            <div className="mt-4 rounded-[14px] border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-800">能力已预留</p>
              <p className="mt-2 text-sm font-normal leading-7 text-slate-600">
                {json.message ?? "当前模块已完成目录、接口和 schema 预留，后续阶段会补齐真实推理与代码生成。"}
              </p>
            </div>
          ) : null}

          {message.messageType === "skill_output" && !isComingSoon ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">这一环节在做什么</p>
                  <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{json.purpose}</p>
                  <p className="mt-4 text-sm font-medium text-slate-800">和你的题目有什么关系</p>
                  <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{json.meaning}</p>
                </div>
                <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-800">变量与模型</p>
                  {renderJsonList(json.variableDesign)}
                  <p className="mt-4 text-sm font-normal leading-7 text-slate-700">{json.modelSpec}</p>
                </div>
              </div>

              {json.stataCode ? (
                <div className="rounded-[14px] bg-slate-950 p-4 text-sm text-slate-100">
                  <p className="mb-3 text-xs font-normal uppercase tracking-[0.18em] text-slate-400">Stata 代码</p>
                  <pre className="overflow-x-auto whitespace-pre-wrap leading-7">{json.stataCode}</pre>
                </div>
              ) : null}

              {json.export?.exportCode ? (
                <div className="rounded-[14px] border border-amber-100 bg-amber-50 p-4 text-sm text-amber-900">
                  <p className="font-medium">回归表导出</p>
                  <p className="mt-2 font-normal">当前写入模式：{formatWriteMode(json.export.writeMode)}</p>
                  <p className="mt-1 font-normal">目标文件：{json.export.filePath}</p>
                  <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6">{json.export.exportCode}</pre>
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
                  {contentText || json.answer}
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
                <p className="text-sm font-medium text-slate-800">白话解释</p>
                <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{json.plainExplanation}</p>
              </div>
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">论文式表述</p>
                <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{json.paperStyleExplanation}</p>
              </div>
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">重点关注</p>
                {renderJsonList(json.analysisPoints)}
              </div>
              <div className="rounded-[14px] border border-slate-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-800">下一步建议</p>
                <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{json.nextSuggestion}</p>
                {Array.isArray(json.missingInfo) && json.missingInfo.length > 0 ? (
                  <p className="mt-3 text-sm font-normal leading-7 text-amber-700">建议补充：{json.missingInfo.join("、")}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          {message.messageType === "stata_error_fix" ? (
            <div className="mt-4 rounded-[14px] border border-slate-100 bg-slate-50 p-4">
              <p className="text-sm font-normal text-slate-700">错误类型：{json.errorType}</p>
              <p className="mt-2 text-sm font-normal leading-7 text-slate-700">{json.explanation}</p>
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-[12px] bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                {json.fixCode}
              </pre>
              <p className="mt-3 text-sm font-normal leading-7 text-slate-700">{json.retryMessage}</p>
            </div>
          ) : null}
        </>
      )}
    </article>
  );

  if (isSystemNotice) {
    if (fullWidth) {
      return <div className="min-w-0">{card}</div>;
    }

    return (
      <div className="flex justify-center">
        <div className="max-w-3xl">{card}</div>
      </div>
    );
  }

  if (fullWidth) {
    return <div className="min-w-0">{card}</div>;
  }

  return (
    <div className="flex items-start gap-3">
      <AgentAvatar />
      <div className="min-w-0 max-w-[86%]">
        <div className="mb-2 flex items-center gap-2 pl-1 text-xs text-slate-500">
          <span className={clsx("font-medium tracking-[0.14em]", meta?.tone)}>TANK</span>
          {stepLabel ? <span>· {stepLabel}</span> : null}
        </div>
        {card}
      </div>
    </div>
  );
}



