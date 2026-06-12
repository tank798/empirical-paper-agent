"use client";

import clsx from "clsx";
import type { AssistantMessageEnvelope, DataDictionaryEntry } from "@empirical/shared";
import { normalizeDisplayText, normalizeRelationshipText, normalizeResearchObjectText } from "../lib/message-display";

type ResearchSetupPanelProps = {
  message: AssistantMessageEnvelope | null;
  onConfirm?: () => void;
  confirmDisabled?: boolean;
  confirmLoading?: boolean;
  className?: string;
};

type SetupField = {
  key: string;
  label: string;
  value: string;
  required?: boolean;
  alwaysShow?: boolean;
  suggested?: boolean;
  helperText?: string;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function listText(value: unknown) {
  if (!Array.isArray(value)) {
    return normalizeDisplayText(value);
  }

  return value.map((item) => normalizeDisplayText(item)).filter(Boolean).join("、");
}

function isMeaningfulValue(value: string, required?: boolean, alwaysShow?: boolean) {
  const normalized = value.trim();
  if (required || alwaysShow) {
    return true;
  }

  if (!normalized) {
    return false;
  }

  return !/^(默认不做|不做|不需要|待补充|正向、负向和不显著)$/i.test(normalized);
}

function isDataDictionaryArray(value: unknown): value is DataDictionaryEntry[] {
  return Array.isArray(value) && value.every((item) => item && typeof item === "object" && typeof item.variableName === "string");
}

function getDraft(message: AssistantMessageEnvelope | null) {
  const json = asRecord(message?.contentJson);
  return asRecord(json.currentDraft ?? json);
}

export function ResearchSetupPanel({
  message,
  onConfirm,
  confirmDisabled = false,
  confirmLoading = false,
  className
}: ResearchSetupPanelProps) {
  const draft = getDraft(message);
  const dataDictionary = isDataDictionaryArray(draft.dataDictionary) ? draft.dataDictionary : [];
  const isTopicConfirm = message?.messageType === "topic_confirm";
  const explicitClusterVar = normalizeDisplayText(draft.clusterVar);
  const suggestedClusterVar = explicitClusterVar || "stkcd";

  const fields: SetupField[] = [
    { key: "normalizedTopic", label: "研究主题", value: normalizeDisplayText(draft.normalizedTopic), required: true },
    { key: "independentVariable", label: "解释变量", value: normalizeDisplayText(draft.independentVariable), required: true },
    { key: "dependentVariable", label: "被解释变量", value: normalizeDisplayText(draft.dependentVariable), required: true },
    {
      key: "researchObject",
      label: "研究对象",
      value: normalizeResearchObjectText(draft.researchObject),
      required: true
    },
    { key: "controls", label: "控制变量", value: listText(draft.controls), required: true },
    { key: "sampleScope", label: "样本区间", value: normalizeDisplayText(draft.sampleScope), required: true },
    { key: "fixedEffects", label: "固定效应", value: listText(draft.fixedEffects), required: true },
    // 面板个体变量和时间变量不再默认展示 stkcd/year，避免把系统经验值误当成用户已提供字段。
    { key: "panelId", label: "面板个体变量", value: normalizeDisplayText(draft.panelId), alwaysShow: true },
    { key: "timeVar", label: "时间变量", value: normalizeDisplayText(draft.timeVar), alwaysShow: true },
    {
      key: "clusterVar",
      label: "聚类变量",
      value: suggestedClusterVar,
      alwaysShow: true,
      suggested: !explicitClusterVar,
      helperText: "通常按公司个体聚类，用于控制同一企业内部误差项相关。"
    },
    {
      key: "relationship",
      label: "关系类型",
      value: normalizeRelationshipText(draft.relationship, draft.normalizedTopic)
    },
    ...(draft.didEnabled === true ? [{ key: "didEnabled", label: "DID 扩展", value: "需要" }] : []),
    ...(draft.psmEnabled === true ? [{ key: "psmEnabled", label: "PSM 扩展", value: "需要" }] : []),
    { key: "instrumentVariable", label: "IV 工具变量", value: normalizeDisplayText(draft.instrumentVariable) },
    { key: "mechanismVariables", label: "机制变量", value: listText(draft.mechanismVariables) },
    { key: "heterogeneityVars", label: "异质性分组", value: listText(draft.heterogeneityVars) }
  ];

  const visibleFields = fields.filter((field) => isMeaningfulValue(field.value, field.required, field.alwaysShow));
  const missingFields = fields.filter((field) => field.required && !field.value);
  const identifiedCount = fields.filter((field) => field.required && field.value).length;

  return (
    <aside
      className={clsx(
        "flex max-h-[calc(100vh-8rem)] min-h-[500px] flex-col rounded-[26px] border border-slate-200 bg-white/92 p-4 shadow-[0_18px_55px_rgba(15,23,42,0.08)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-normal text-slate-950">研究设定</h2>
          <p className="mt-1 text-xs text-slate-500">
            已识别 {identifiedCount} 项
            {missingFields.length > 0 ? `，待补充 ${missingFields.length} 项` : "，可确认"}
          </p>
        </div>
      </div>

      <div className="hidden-scrollbar mt-4 flex-1 overflow-y-auto pr-1">
        {visibleFields.length > 0 ? (
          <div className="space-y-2.5">
            {visibleFields.map((field) => (
              <div key={field.key} className="rounded-[14px] border border-slate-100 bg-slate-50 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-semibold text-slate-500">{field.label}</p>
                  {field.suggested ? (
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-400">
                      系统建议
                    </span>
                  ) : null}
                </div>
                <p className={clsx("mt-1 break-words text-[15px] font-semibold leading-6", field.value ? "text-slate-950" : "text-slate-400")}>
                  {field.value || "待补充"}
                </p>
                {field.helperText ? <p className="mt-1.5 text-xs leading-5 text-slate-500">{field.helperText}</p> : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-[16px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-7 text-slate-500">
            发送研究主题、研究对象、变量和样本信息后，我会在这里整理成结构化设定。
          </p>
        )}

        {dataDictionary.length > 0 ? (
          <div className="mt-4 rounded-[16px] border border-slate-100 bg-slate-50 px-4 py-3">
            <p className="text-xs text-slate-500">数据字典</p>
            <p className="mt-1 text-sm font-medium text-slate-950">已识别 {dataDictionary.length} 个字段</p>
          </div>
        ) : null}

        {/* 底部待补充汇总卡片已删除，避免与顶部计数和字段级“待补充”重复。 */}
      </div>

      {onConfirm && isTopicConfirm ? (
        <button
          className="mt-5 inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-55"
          disabled={confirmDisabled || confirmLoading}
          onClick={onConfirm}
          type="button"
        >
          确认主题
        </button>
      ) : null}
    </aside>
  );
}
