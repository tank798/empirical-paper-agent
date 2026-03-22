import {
  ExportWriteMode,
  SkillName,
  type DataCheckInput,
  type DataCheckOutput,
  type DataCleaningInput,
  type DataCleaningOutput,
  type GeneralResearchChatInput,
  type GeneralResearchChatOutput,
  type RegressionSkillInput,
  type RegressionSkillOutput,
  type ResultInterpretInput,
  type ResultInterpretOutput,
  type StataErrorDebugInput,
  type StataErrorDebugOutput,
  type TermMapping,
  type TopicNormalizeOutput
} from "@empirical/shared";
import { buildTermAliasBundle } from "../research-profile/term-mappings";

type RegressionModuleVariant = "baseline" | "robustness" | "iv" | "mechanism" | "heterogeneity";

const TERM_CATEGORY_LABELS: Record<TermMapping["category"], string> = {
  independent: "\u89e3\u91ca\u53d8\u91cf",
  dependent: "\u88ab\u89e3\u91ca\u53d8\u91cf",
  control: "\u63a7\u5236\u53d8\u91cf",
  fixed_effect: "\u56fa\u5b9a\u6548\u5e94",
  cluster: "\u805a\u7c7b\u53d8\u91cf",
  panel: "\u9762\u677f\u4e2a\u4f53\u53d8\u91cf",
  time: "\u65f6\u95f4\u53d8\u91cf"
};

const MODULE_EXPORT_FILES: Record<RegressionModuleVariant, string> = {
  baseline: "baseline regression.doc",
  robustness: "robustness check.doc",
  iv: "iv analysis.doc",
  mechanism: "mechanism analysis.doc",
  heterogeneity: "heterogeneity analysis.doc"
};

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function buildExportPath(fileName: string) {
  return `D:\\results\\${fileName}`;
}

function buildOutregLine(filePath: string, writeMode: ExportWriteMode) {
  return `outreg2 using "${filePath}", ${writeMode} bdec(3) tdec(2) adjr2 tstat`;
}

function buildExportNoticeLines(fileName: string) {
  return ["* \u8bf7\u628a D:\\results\\ \u66ff\u6362\u6210\u4f60\u81ea\u5df1\u7684\u5bfc\u51fa\u8def\u5f84", `* \u6587\u4ef6\u540d\u4e5f\u53ef\u4ee5\u6309\u9700\u81ea\u884c\u4fee\u6539\uff1a${fileName}`];
}

function buildInstallLines(commands: Array<{ command: string; install: string }>) {
  const seen = new Set<string>();
  return commands.flatMap((item) => {
    if (seen.has(item.command)) {
      return [];
    }

    seen.add(item.command);
    return [
      `* \u5982\u679c\u4f60\u4ee5\u524d\u6ca1\u5b89\u88c5\u8fc7 ${item.command}\uff0c\u8bf7\u5148\u8fd0\u884c\u4e0b\u4e00\u884c\uff1b\u5b89\u88c5\u8fc7\u7684\u8bdd\u53ef\u4ee5\u76f4\u63a5\u5ffd\u7565\uff0c\u6216\u8005\u7528 Ctrl+/ \u6ce8\u91ca\u6389`,
      item.install
    ];
  });
}

function buildRenameTemplateLines(termMappings: TermMapping[]) {
  return [
    "* \u4e0b\u9762\u8fd9\u7ec4 rename \u7684\u610f\u601d\u662f\uff1a\u628a\u4f60\u6570\u636e\u91cc\u7684\u539f\u59cb\u53d8\u91cf\u540d\u7edf\u4e00\u6539\u6210\u540e\u7eed\u4ee3\u7801\u4f7f\u7528\u7684\u82f1\u6587\u7f29\u5199",
    "* \u8bf7\u628a\u5de6\u4fa7 old_* \u5360\u4f4d\u7b26\u66ff\u6362\u6210\u4f60\u81ea\u5df1\u6570\u636e\u91cc\u7684\u771f\u5b9e\u5b57\u6bb5\u540d",
    ...termMappings.map(
      (item) => `rename old_${item.alias} ${item.alias} // ${TERM_CATEGORY_LABELS[item.category]}: ${item.labelCn}`
    )
  ];
}

function buildReghdfeCommand(
  dependentAlias: string,
  explanatoryAliases: string[],
  options: string[] = [],
  whereClause = ""
) {
  const regressors = unique(explanatoryAliases);
  const optionCopy = options.filter(Boolean);
  return `reghdfe ${dependentAlias} ${regressors.join(" ")}${whereClause ? ` ${whereClause}` : ""}${optionCopy.length ? `, ${optionCopy.join(" ")}` : ""}`;
}

function buildIvreghdfeCommand(
  dependentAlias: string,
  independentAlias: string,
  instrumentAlias: string,
  controls: string[],
  options: string[] = []
) {
  const regressors = unique([`(${independentAlias} = ${instrumentAlias})`, ...controls]);
  const optionCopy = options.filter(Boolean);
  return `ivreghdfe ${dependentAlias} ${regressors.join(" ")}${optionCopy.length ? `, ${optionCopy.join(" ")}` : ""}`;
}

function buildCommonVariableDesign(input: RegressionSkillInput) {
  return [
    `\u88ab\u89e3\u91ca\u53d8\u91cf\uff1a${input.dependentVariable}`,
    `\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\uff1a${input.independentVariable}`,
    `\u63a7\u5236\u53d8\u91cf\uff1a${input.controls?.length ? input.controls.join("\u3001") : "\u8bf7\u6309\u6587\u732e\u53e3\u5f84\u8865\u5145"}`,
    `\u56fa\u5b9a\u6548\u5e94\uff1a${input.fixedEffects?.length ? input.fixedEffects.join("\u3001") : "\u8bf7\u81f3\u5c11\u8865\u5145\u4f01\u4e1a\u548c\u5e74\u4efd\u56fa\u5b9a\u6548\u5e94"}`,
    `\u6837\u672c\u533a\u95f4\uff1a${input.sampleScope || "\u8bf7\u8865\u5145\u6837\u672c\u533a\u95f4"}`
  ];
}

function buildBaseOptions(fixedEffectAliases: string[], clusterAlias: string) {
  const options: string[] = [];
  if (fixedEffectAliases.length > 0) {
    options.push(`absorb(${fixedEffectAliases.join(" ")})`);
  }
  if (clusterAlias) {
    options.push(`vce(cluster ${clusterAlias})`);
  }
  return options;
}

function buildSimpleRegressionOptions(clusterAlias: string) {
  return clusterAlias ? [`vce(cluster ${clusterAlias})`] : [];
}

export function buildDataCleaningOutputTemplate(input: DataCleaningInput): DataCleaningOutput {
  const aliasBundle = buildTermAliasBundle({
    dependentVariable: input.dependentVariable,
    independentVariable: input.independentVariable,
    controls: input.controls,
    fixedEffects: input.fixedEffects,
    clusterVar: input.clusterVar,
    panelId: input.panelId,
    timeVar: input.timeVar,
    termMappings: input.termMappings
  });
  const variables = unique([
    aliasBundle.dependentAlias,
    aliasBundle.independentAlias,
    ...aliasBundle.controlAliases
  ]);
  const missingTargets = unique([aliasBundle.dependentAlias, aliasBundle.independentAlias]);
  const logCode = (input.needLogVars ?? []).length
    ? input.needLogVars.map((item) => `gen ln_${item} = ln(${item})`).join("\n")
    : "* \u5982\u9700\u5bf9\u89c4\u6a21\u7c7b\u53d8\u91cf\u53d6\u5bf9\u6570\uff0c\u53ef\u5728\u8fd9\u91cc\u8865\u5145 ln_ \u53d8\u91cf\u751f\u6210\u4ee3\u7801";
  const panelAlias = aliasBundle.panelAlias || aliasBundle.preferredPanelAlias;
  const timeAlias = aliasBundle.timeAlias || aliasBundle.preferredTimeAlias;

  const stataLines = [
    ...buildRenameTemplateLines(aliasBundle.termMappings),
    "",
    ...buildInstallLines([{ command: "winsor2", install: "ssc install winsor2, replace" }]),
    "",
    `destring ${variables.join(" ")}, replace force`,
    `drop if missing(${missingTargets.join(", ")})`,
    logCode,
    `winsor2 ${variables.join(" ")}, replace cuts(1 99)`
  ];

  if (panelAlias && timeAlias) {
    stataLines.push(`xtset ${panelAlias} ${timeAlias}`);
  }

  return {
    moduleName: "data_cleaning",
    purpose: "\u5148\u628a\u5173\u952e\u53d8\u91cf\u7edf\u4e00\u547d\u540d\u3001\u6e05\u6d17\u5e76\u6574\u7406\u6210\u53ef\u76f4\u63a5\u8fdb\u5165\u56de\u5f52\u7684\u5206\u6790\u6837\u672c\u3002",
    meaning: `\u8fd9\u4e00\u90e8\u5206\u56f4\u7ed5 ${input.independentVariable}\u3001${input.dependentVariable} \u4ee5\u53ca\u63a7\u5236\u53d8\u91cf\uff0c\u5b8c\u6210\u7edf\u4e00\u82f1\u6587\u7f29\u5199\u3001\u7f3a\u5931\u503c\u5904\u7406\u548c\u6781\u7aef\u503c\u5904\u7406\u3002`,
    variableDesign: [
      "\u5148\u7edf\u4e00\u53d8\u91cf\u547d\u540d\u89c4\u5219\uff0c\u4fdd\u8bc1\u540e\u7eed\u6240\u6709\u6a21\u5757\u90fd\u4f7f\u7528\u540c\u4e00\u5957\u82f1\u6587\u7f29\u5199\u3002",
      ...variables.map((item) => `\u68c0\u67e5 ${item} \u7684\u53d8\u91cf\u7c7b\u578b\u3001\u7f3a\u5931\u503c\u4e0e\u6781\u7aef\u503c\u60c5\u51b5`)
    ],
    termMappings: aliasBundle.termMappings,
    modelSpec: "\u540e\u7eed\u6240\u6709\u6a21\u5757\u90fd\u4f1a\u7edf\u4e00\u6cbf\u7528\u8fd9\u4e00\u7ec4\u82f1\u6587\u7f29\u5199\u6765\u5199 Stata \u4ee3\u7801\u3002",
    stataCode: stataLines.join("\n"),
    codeExplanation: [
      "\u5f00\u5934\u7684 rename \u6a21\u677f\u8868\u793a\uff1a\u5148\u628a\u539f\u59cb\u5b57\u6bb5\u540d\u6539\u6210\u540e\u7eed\u4ee3\u7801\u7edf\u4e00\u4f7f\u7528\u7684\u82f1\u6587\u7f29\u5199\uff1b\u8bf7\u628a\u5de6\u4fa7 old_* \u5360\u4f4d\u7b26\u66ff\u6362\u6210\u4f60\u81ea\u5df1\u7684\u771f\u5b9e\u53d8\u91cf\u540d\u3002",
      "ssc install winsor2, replace \u53ea\u5728\u4f60\u4ee5\u524d\u6ca1\u5b89\u88c5\u8fc7 winsor2 \u65f6\u8fd0\u884c\u5373\u53ef\uff1b\u88c5\u8fc7\u7684\u8bdd\u53ef\u4ee5\u76f4\u63a5\u5ffd\u7565\uff0c\u6216\u8005\u7528 Ctrl+/ \u6ce8\u91ca\u6389\u3002",
      "destring \u7528\u4e8e\u628a\u88ab\u8bef\u5bfc\u5165\u4e3a\u5b57\u7b26\u578b\u7684\u53d8\u91cf\u8f6c\u6210\u6570\u503c\u578b\u3002",
      "drop if missing(...) \u7528\u4e8e\u5220\u9664\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u548c\u88ab\u89e3\u91ca\u53d8\u91cf\u7f3a\u5931\u7684\u6837\u672c\u3002",
      "winsor2 \u7528\u4e8e\u7f29\u5c3e\u5904\u7406\u6781\u7aef\u503c\uff0c\u51cf\u5c11\u6781\u7aef\u6837\u672c\u5bf9\u540e\u7eed\u56de\u5f52\u7684\u5e72\u6270\u3002"
    ],
    interpretationGuide: [
      "\u5148\u786e\u8ba4 rename \u6a21\u677f\u91cc\u7684\u82f1\u6587\u7f29\u5199\u548c\u4f60\u7684\u771f\u5b9e\u5b57\u6bb5\u540d\u80fd\u4e00\u4e00\u5bf9\u5e94\u3002",
      "\u6e05\u6d17\u5b8c\u6210\u540e\u5efa\u8bae\u8fd0\u884c summarize\uff0c\u68c0\u67e5\u53d8\u91cf\u91cf\u7ea7\u548c\u53d6\u503c\u8303\u56f4\u662f\u5426\u5408\u7406\u3002",
      "\u540e\u7eed\u56de\u5f52\u7ee7\u7eed\u6cbf\u7528\u8fd9\u5957\u82f1\u6587\u7f29\u5199\uff0c\u4ee3\u7801\u4f1a\u66f4\u5bb9\u6613\u7ef4\u62a4\u3002"
    ],
    nextSuggestion: "\u6570\u636e\u6e05\u6d17\u5b8c\u6210\u540e\uff0c\u4e0b\u4e00\u6b65\u5efa\u8bae\u8fdb\u5165\u6570\u636e\u68c0\u67e5\u4e0e\u63cf\u8ff0\u7edf\u8ba1\u3002"
  };
}

export function buildDataCheckOutputTemplate(input: DataCheckInput): DataCheckOutput {
  const keyVariables = unique(input.keyVariables ?? []);
  const lines = ["describe", `summarize ${keyVariables.join(" ")}`];

  if (input.timeVar) {
    lines.push(`tab ${input.timeVar}`);
  }
  if (input.panelId && input.timeVar) {
    lines.push(`xtset ${input.panelId} ${input.timeVar}`);
  }

  return {
    moduleName: "data_check",
    purpose: "\u786e\u8ba4\u6837\u672c\u7ed3\u6784\u3001\u63cf\u8ff0\u7edf\u8ba1\u548c\u9762\u677f\u8bbe\u5b9a\u662f\u5426\u53ef\u7528\u3002",
    meaning: "\u8fd9\u4e00\u90e8\u5206\u4e3b\u8981\u68c0\u67e5\u53d8\u91cf\u5206\u5e03\u3001\u5e74\u4efd\u8986\u76d6\u3001\u6837\u672c\u91cf\u548c\u9762\u677f\u7ed3\u6784\uff0c\u907f\u514d\u6b63\u5f0f\u56de\u5f52\u65f6\u624d\u66b4\u9732\u6570\u636e\u95ee\u9898\u3002",
    variableDesign: keyVariables.map((item) => `\u67e5\u770b ${item} \u7684\u63cf\u8ff0\u7edf\u8ba1\u548c\u5206\u5e03\u60c5\u51b5`),
    modelSpec: "\u672c\u73af\u8282\u4ecd\u7136\u4ee5\u6570\u636e\u6838\u67e5\u4e3a\u4e3b\uff0c\u4e0d\u76f4\u63a5\u5f62\u6210\u6b63\u5f0f\u56de\u5f52\u7ed3\u8bba\u3002",
    stataCode: lines.join("\n"),
    codeExplanation: [
      "describe \u7528\u4e8e\u5feb\u901f\u67e5\u770b\u53d8\u91cf\u7c7b\u578b\u3001\u6807\u7b7e\u548c\u5b58\u50a8\u683c\u5f0f\u3002",
      "summarize \u7528\u4e8e\u68c0\u67e5\u5173\u952e\u53d8\u91cf\u7684\u5747\u503c\u3001\u6807\u51c6\u5dee\u4e0e\u6781\u503c\u3002",
      input.timeVar ? `tab ${input.timeVar} \u7528\u4e8e\u68c0\u67e5\u65f6\u95f4\u7ef4\u5ea6\u662f\u5426\u8fde\u7eed\u3002` : "\u5f53\u524d\u6ca1\u6709\u63d0\u4f9b\u65f6\u95f4\u53d8\u91cf\uff0c\u56e0\u6b64\u8df3\u8fc7\u5e74\u4efd\u5206\u5e03\u68c0\u67e5\u3002",
      input.panelId && input.timeVar ? "xtset \u7528\u4e8e\u9a8c\u8bc1\u9762\u677f\u8bbe\u5b9a\u662f\u5426\u6210\u7acb\u3002" : "\u82e5\u540e\u7eed\u8981\u505a\u9762\u677f\u56de\u5f52\uff0c\u8bf7\u8865\u5145\u4e2a\u4f53\u7ef4\u5ea6\u548c\u65f6\u95f4\u7ef4\u5ea6\u53d8\u91cf\u3002"
    ],
    checkItems: ["\u53d8\u91cf\u7c7b\u578b\u662f\u5426\u6b63\u786e", "\u6837\u672c\u91cf\u662f\u5426\u5408\u7406", "\u5e74\u4efd\u8986\u76d6\u662f\u5426\u5b8c\u6574", "\u9762\u677f\u7ed3\u6784\u662f\u5426\u53ef\u7528"],
    nextSuggestion: "\u6570\u636e\u68c0\u67e5\u65e0\u8bef\u540e\uff0c\u5c31\u53ef\u4ee5\u8fdb\u5165\u57fa\u51c6\u56de\u5f52\u3002"
  };
}

export function buildRegressionModuleOutput(
  moduleName: string,
  input: RegressionSkillInput,
  moduleLabel: string,
  variant: RegressionModuleVariant
): RegressionSkillOutput {
  const aliasBundle = buildTermAliasBundle({
    dependentVariable: input.dependentVariable,
    independentVariable: input.independentVariable,
    controls: input.controls,
    fixedEffects: input.fixedEffects,
    clusterVar: input.clusterVar,
    panelId: input.panelId,
    timeVar: input.timeVar,
    termMappings: input.termMappings
  });
  const fixedEffectAliases = aliasBundle.fixedEffectAliases;
  const clusterAlias = aliasBundle.clusterAlias || aliasBundle.preferredPanelAlias;
  const timeAlias = aliasBundle.timeAlias || aliasBundle.preferredTimeAlias || "year";
  const fileName = MODULE_EXPORT_FILES[variant];
  const filePath = buildExportPath(fileName);
  const baselineInstallLines = buildInstallLines([
    { command: "reghdfe", install: "ssc install reghdfe, replace" },
    { command: "outreg2", install: "ssc install outreg2, replace" }
  ]);

  const baseline: RegressionSkillOutput = {
    moduleName,
    purpose: `${moduleLabel}\u7528\u4e8e\u68c0\u9a8c\u6838\u5fc3\u7814\u7a76\u5047\u8bbe\u662f\u5426\u6210\u7acb\u3002`,
    meaning: `\u5728\u5f53\u524d\u7814\u7a76\u8bbe\u5b9a\u4e0b\uff0c\u91cd\u70b9\u5173\u6ce8 ${input.independentVariable} \u5bf9 ${input.dependentVariable} \u7684\u65b9\u5411\u3001\u663e\u8457\u6027\u548c\u7ecf\u6d4e\u542b\u4e49\u3002`,
    variableDesign: buildCommonVariableDesign(input),
    termMappings: aliasBundle.termMappings,
    instrumentSelectionCriteria: [],
    mechanismPaths: [],
    modelSpec: `\u6a21\u578b 1\uff1a${aliasBundle.dependentAlias} = beta0 + beta1 ${aliasBundle.independentAlias} + error\uff1b\u6a21\u578b 2 \u5728\u6b64\u57fa\u7840\u4e0a\u52a0\u5165\u63a7\u5236\u53d8\u91cf\uff1b\u6a21\u578b 3 \u518d\u52a0\u5165\u56fa\u5b9a\u6548\u5e94\u3002`,
    stataCode: [
      ...baselineInstallLines,
      "",
      ...buildExportNoticeLines(fileName),
      "",
      buildReghdfeCommand(aliasBundle.dependentAlias, [aliasBundle.independentAlias], buildSimpleRegressionOptions(clusterAlias)),
      buildOutregLine(filePath, ExportWriteMode.REPLACE),
      "",
      buildReghdfeCommand(
        aliasBundle.dependentAlias,
        [aliasBundle.independentAlias, ...aliasBundle.controlAliases],
        buildSimpleRegressionOptions(clusterAlias)
      ),
      buildOutregLine(filePath, ExportWriteMode.APPEND),
      "",
      buildReghdfeCommand(
        aliasBundle.dependentAlias,
        [aliasBundle.independentAlias, ...aliasBundle.controlAliases],
        buildBaseOptions(fixedEffectAliases, clusterAlias)
      ),
      buildOutregLine(filePath, ExportWriteMode.APPEND)
    ].join("\n"),
    codeExplanation: [
      "ssc install reghdfe, replace \u548c ssc install outreg2, replace \u53ea\u5728\u4f60\u4ee5\u524d\u6ca1\u5b89\u88c5\u8fc7\u8fd9\u4e9b\u547d\u4ee4\u65f6\u8fd0\u884c\u5373\u53ef\uff1b\u88c5\u8fc7\u7684\u8bdd\u53ef\u4ee5\u76f4\u63a5\u5ffd\u7565\uff0c\u6216\u8005\u7528 Ctrl+/ \u6ce8\u91ca\u6389\u3002",
      "\u7b2c\u4e00\u6761\u6a21\u578b\u5148\u53ea\u68c0\u9a8c\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u4e0e\u88ab\u89e3\u91ca\u53d8\u91cf\u4e4b\u95f4\u7684\u57fa\u7840\u5173\u7cfb\u3002",
      "\u7b2c\u4e8c\u6761\u6a21\u578b\u5728\u6b64\u57fa\u7840\u4e0a\u52a0\u5165\u63a7\u5236\u53d8\u91cf\uff0c\u89c2\u5bdf\u4e3b\u6548\u5e94\u662f\u5426\u7a33\u5b9a\u3002",
      "\u7b2c\u4e09\u6761\u6a21\u578b\u8fdb\u4e00\u6b65\u52a0\u5165\u56fa\u5b9a\u6548\u5e94\uff0c\u4f5c\u4e3a\u8bba\u6587\u4e2d\u7684\u4e3b\u89c4\u683c\u3002",
      "\u6bcf\u6761\u56de\u5f52\u540e\u90fd\u76f4\u63a5\u8ddf outreg2\uff0c\u7b2c\u4e00\u6761\u7528 replace\uff0c\u540e\u4e24\u6761\u7528 append\u3002"
    ],
    interpretationGuide: [
      "\u5148\u770b\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u7684\u7cfb\u6570\u65b9\u5411\u662f\u5426\u7b26\u5408\u7406\u8bba\u9884\u671f\u3002",
      "\u518d\u6bd4\u8f83\u52a0\u5165\u63a7\u5236\u53d8\u91cf\u548c\u56fa\u5b9a\u6548\u5e94\u540e\uff0c\u6838\u5fc3\u7cfb\u6570\u662f\u5426\u7a33\u5b9a\u3002",
      "\u4ee3\u7801\u4e2d\u7684 D:\\results\\ \u53ea\u662f\u793a\u4f8b\u8def\u5f84\uff0c\u8fd0\u884c\u524d\u8bf7\u6539\u6210\u4f60\u81ea\u5df1\u7684\u5bfc\u51fa\u8def\u5f84\u3002"
    ],
    nextSuggestion: "\u5b8c\u6210\u57fa\u51c6\u56de\u5f52\u540e\uff0c\u53ef\u4ee5\u7ee7\u7eed\u770b\u7a33\u5065\u6027\u3001\u5185\u751f\u6027\u3001\u673a\u5236\u548c\u5f02\u8d28\u6027\u5206\u6790\u3002"
  };

  if (variant === "baseline") {
    return baseline;
  }

  if (variant === "robustness") {
    return {
      ...baseline,
      purpose: "\u7a33\u5065\u6027\u68c0\u9a8c\u7528\u4e8e\u786e\u8ba4\u4e3b\u7ed3\u8bba\u4e0d\u4f9d\u8d56\u67d0\u4e00\u4e2a\u53d8\u91cf\u53e3\u5f84\u6216\u7279\u5b9a\u6837\u672c\u533a\u95f4\u3002",
      meaning: "\u8fd9\u4e00\u90e8\u5206\u91cd\u70b9\u5c55\u793a\u4e24\u7c7b\u5e38\u89c1\u7a33\u5065\u6027\u68c0\u9a8c\uff1a\u66ff\u6362\u53d8\u91cf\u53e3\u5f84\uff0c\u4ee5\u53ca\u8c03\u6574\u6837\u672c\u533a\u95f4\u3002",
      modelSpec: "\u7a33\u5065\u6027\u68c0\u9a8c 1 \u4f7f\u7528\u66ff\u4ee3\u53e3\u5f84\u53d8\u91cf\uff1b\u7a33\u5065\u6027\u68c0\u9a8c 2 \u8c03\u6574\u6837\u672c\u671f\uff0c\u518d\u6bd4\u8f83\u6838\u5fc3\u7cfb\u6570\u65b9\u5411\u548c\u663e\u8457\u6027\u662f\u5426\u7a33\u5b9a\u3002",
      stataCode: [
        ...baselineInstallLines,
        "",
        ...buildExportNoticeLines(fileName),
        "",
        "* \u7a33\u5065\u6027\u68c0\u9a8c 1\uff1a\u66ff\u6362\u53d8\u91cf\u53e3\u5f84\uff0c\u8bf7\u628a x_alt \u6216 y_alt \u66ff\u6362\u6210\u4f60\u7684\u66ff\u4ee3\u53e3\u5f84\u53d8\u91cf",
        `* \u5982\u679c\u4f60\u60f3\u66ff\u6362\u88ab\u89e3\u91ca\u53d8\u91cf\uff0c\u8bf7\u628a ${aliasBundle.dependentAlias} \u6539\u6210 y_alt\uff1b\u5982\u679c\u60f3\u66ff\u6362\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\uff0c\u8bf7\u628a ${aliasBundle.independentAlias} \u6539\u6210 x_alt`,
        buildReghdfeCommand(
          aliasBundle.dependentAlias,
          ["x_alt", ...aliasBundle.controlAliases],
          buildBaseOptions(fixedEffectAliases, clusterAlias)
        ),
        buildOutregLine(filePath, ExportWriteMode.REPLACE),
        "",
        "* \u7a33\u5065\u6027\u68c0\u9a8c 2\uff1a\u8c03\u6574\u6837\u672c\u533a\u95f4\uff0c\u8bf7\u628a 2012 \u548c 2021 \u66ff\u6362\u6210\u4f60\u81ea\u5df1\u7684\u5907\u9009\u6837\u672c\u671f",
        buildReghdfeCommand(
          aliasBundle.dependentAlias,
          [aliasBundle.independentAlias, ...aliasBundle.controlAliases],
          buildBaseOptions(fixedEffectAliases, clusterAlias),
          `if inrange(${timeAlias}, 2012, 2021)`
        ),
        buildOutregLine(filePath, ExportWriteMode.APPEND)
      ].join("\n"),
      codeExplanation: [
        "\u7b2c\u4e00\u7ec4\u4ee3\u7801\u901a\u8fc7\u66ff\u6362\u53d8\u91cf\u53e3\u5f84\uff0c\u68c0\u67e5\u4e3b\u7ed3\u8bba\u662f\u5426\u53ea\u4f9d\u8d56\u67d0\u4e00\u4e2a\u7279\u5b9a\u6d4b\u91cf\u65b9\u5f0f\u3002",
        "\u7b2c\u4e8c\u7ec4\u4ee3\u7801\u901a\u8fc7\u8c03\u6574\u6837\u672c\u533a\u95f4\uff0c\u68c0\u67e5\u7ed3\u679c\u662f\u5426\u53ea\u5728\u67d0\u4e00\u6bb5\u5e74\u4efd\u6210\u7acb\u3002",
        "\u7a33\u5065\u6027\u68c0\u9a8c\u91cd\u70b9\u770b\u6838\u5fc3\u7cfb\u6570\u7684\u65b9\u5411\u548c\u663e\u8457\u6027\u662f\u5426\u4fdd\u6301\u4e00\u81f4\uff0c\u800c\u4e0d\u662f\u8981\u6c42\u6570\u503c\u5b8c\u5168\u4e00\u6837\u3002"
      ],
      interpretationGuide: [
        "\u6bd4\u8f83\u66ff\u6362\u53d8\u91cf\u53e3\u5f84\u540e\uff0c\u6838\u5fc3\u7cfb\u6570\u7684\u65b9\u5411\u548c\u663e\u8457\u6027\u662f\u5426\u4e0e\u57fa\u51c6\u56de\u5f52\u4e00\u81f4\u3002",
        "\u6bd4\u8f83\u8c03\u6574\u6837\u672c\u533a\u95f4\u540e\uff0c\u7ed3\u8bba\u662f\u5426\u4f9d\u7136\u7a33\u5b9a\u3002",
        "\u5982\u679c\u53ea\u6709\u5728\u67d0\u4e00\u4e2a\u53e3\u5f84\u6216\u6837\u672c\u671f\u4e0b\u663e\u8457\uff0c\u9700\u8981\u5728\u8bba\u6587\u91cc\u989d\u5916\u89e3\u91ca\u3002"
      ],
      nextSuggestion: "\u7a33\u5065\u6027\u68c0\u9a8c\u7a33\u5b9a\u540e\uff0c\u53ef\u4ee5\u7ee7\u7eed\u5904\u7406\u5185\u751f\u6027\u95ee\u9898\u3002"
    };
  }

  if (variant === "iv") {
    return {
      ...baseline,
      purpose: "\u5185\u751f\u6027\u5206\u6790\u7528\u4e8e\u7f13\u89e3\u53cd\u5411\u56e0\u679c\u3001\u9057\u6f0f\u53d8\u91cf\u6216\u6d4b\u91cf\u8bef\u5dee\u5e26\u6765\u7684\u4f30\u8ba1\u504f\u8bef\u3002",
      meaning: "\u8fd9\u4e00\u90e8\u5206\u7ed9\u51fa\u5de5\u5177\u53d8\u91cf\u8bc6\u522b\u6a21\u677f\u3002\u5de5\u5177\u53d8\u91cf\u662f\u4e00\u7c7b\u7528\u6765\u8bc6\u522b\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u5916\u751f\u53d8\u52a8\u7684\u4fe1\u606f\u6765\u6e90\uff0c\u4f46\u5b83\u4e0d\u7b49\u4e8e\u201c\u5916\u751f\u51b2\u51fb\u201d\u8fd9\u4e2a\u6982\u5ff5\uff1b\u5916\u751f\u51b2\u51fb\u53ea\u662f\u5de5\u5177\u53d8\u91cf\u53ef\u80fd\u7684\u6765\u6e90\u4e4b\u4e00\u3002",
      instrumentSelectionCriteria: [
        "\u76f8\u5173\u6027\uff1a\u5de5\u5177\u53d8\u91cf\u5e94\u4e0e\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u663e\u8457\u76f8\u5173\uff0c\u4e14\u7b2c\u4e00\u9636\u6bb5\u4e0d\u80fd\u592a\u5f31\u3002",
        "\u5916\u751f\u6027\uff1a\u5de5\u5177\u53d8\u91cf\u4e0d\u80fd\u76f4\u63a5\u5f71\u54cd\u88ab\u89e3\u91ca\u53d8\u91cf\uff0c\u4e5f\u4e0d\u80fd\u548c\u8bef\u5dee\u9879\u76f8\u5173\u3002",
        "\u6392\u4ed6\u6027\uff1a\u5de5\u5177\u53d8\u91cf\u53ea\u80fd\u901a\u8fc7\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u8fd9\u4e00\u6761\u8def\u5f84\u5f71\u54cd\u7ed3\u679c\u53d8\u91cf\u3002",
        "\u53ef\u8bba\u8bc1\u6027\uff1a\u6700\u597d\u80fd\u4ece\u5236\u5ea6\u3001\u5730\u7406\u3001\u5386\u53f2\u6216\u653f\u7b56\u80cc\u666f\u4e2d\u7ed9\u51fa\u6e05\u6670\u6765\u6e90\u3002"
      ],
      modelSpec: `\u7b2c\u4e00\u9636\u6bb5\u7528\u5de5\u5177\u53d8\u91cf iv_var \u89e3\u91ca ${aliasBundle.independentAlias}\uff0c\u7b2c\u4e8c\u9636\u6bb5\u518d\u4f30\u8ba1 ${aliasBundle.independentAlias} \u5bf9 ${aliasBundle.dependentAlias} \u7684\u51c0\u6548\u5e94\u3002`,
      stataCode: [
        ...buildInstallLines([
          { command: "ivreghdfe", install: "ssc install ivreghdfe, replace" },
          { command: "outreg2", install: "ssc install outreg2, replace" }
        ]),
        "",
        ...buildExportNoticeLines(fileName),
        "",
        "* \u8bf7\u628a iv_var \u66ff\u6362\u6210\u4f60\u771f\u6b63\u7684\u5de5\u5177\u53d8\u91cf",
        "* \u5982\u679c\u4f60\u6709\u591a\u4e2a\u5de5\u5177\u53d8\u91cf\uff0c\u53ef\u4ee5\u628a\u5b83\u4eec\u4e00\u8d77\u653e\u5230\u62ec\u53f7\u91cc\uff0c\u518d\u8865\u5145\u8fc7\u5ea6\u8bc6\u522b\u68c0\u9a8c",
        buildIvreghdfeCommand(
          aliasBundle.dependentAlias,
          aliasBundle.independentAlias,
          "iv_var",
          aliasBundle.controlAliases,
          buildBaseOptions(fixedEffectAliases, clusterAlias)
        ),
        buildOutregLine(filePath, ExportWriteMode.REPLACE),
        "estat firststage"
      ].join("\n"),
      codeExplanation: [
        "ssc install ivreghdfe, replace \u548c ssc install outreg2, replace \u53ea\u5728\u4f60\u4ee5\u524d\u6ca1\u5b89\u88c5\u8fc7\u8fd9\u4e9b\u547d\u4ee4\u65f6\u8fd0\u884c\u5373\u53ef\uff1b\u88c5\u8fc7\u7684\u8bdd\u53ef\u4ee5\u76f4\u63a5\u5ffd\u7565\uff0c\u6216\u8005\u7528 Ctrl+/ \u6ce8\u91ca\u6389\u3002",
        "iv_var \u53ea\u662f\u5360\u4f4d\u7b26\uff0c\u9700\u8981\u66ff\u6362\u6210\u771f\u6b63\u6709\u7406\u8bba\u652f\u6491\u7684\u5de5\u5177\u53d8\u91cf\u3002",
        "ivreghdfe \u9002\u5408\u5728\u56fa\u5b9a\u6548\u5e94\u6846\u67b6\u4e0b\u505a\u4e24\u9636\u6bb5\u4f30\u8ba1\u3002",
        "estat firststage \u7528\u4e8e\u68c0\u67e5\u7b2c\u4e00\u9636\u6bb5\u662f\u5426\u8db3\u591f\u5f3a\u3002"
      ],
      interpretationGuide: [
        "\u5148\u770b\u7b2c\u4e00\u9636\u6bb5\u5de5\u5177\u53d8\u91cf\u662f\u5426\u663e\u8457\uff0c\u662f\u5426\u5b58\u5728\u5f31\u5de5\u5177\u53d8\u91cf\u95ee\u9898\u3002",
        "\u518d\u770b\u7b2c\u4e8c\u9636\u6bb5\u6838\u5fc3\u7cfb\u6570\u65b9\u5411\u662f\u5426\u4e0e\u57fa\u51c6\u56de\u5f52\u4e00\u81f4\u3002",
        "\u5982\u679c\u5de5\u5177\u53d8\u91cf\u7684\u5916\u751f\u6027\u8bba\u8bc1\u4e0d\u5145\u5206\uff0cIV \u7ed3\u8bba\u4ecd\u7136\u4e0d\u7a33\u3002"
      ],
      nextSuggestion: "\u5982\u679c\u4f60\u5df2\u7ecf\u6709\u660e\u786e\u7684\u5de5\u5177\u53d8\u91cf\u5019\u9009\uff0c\u53ef\u4ee5\u7ee7\u7eed\u8865\u5145\u5f31\u5de5\u5177\u53d8\u91cf\u548c\u8fc7\u5ea6\u8bc6\u522b\u68c0\u9a8c\u3002"
    };
  }

  if (variant === "mechanism") {
    return {
      ...baseline,
      purpose: "\u673a\u5236\u5206\u6790\u7528\u4e8e\u89e3\u91ca\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u4e3a\u4ec0\u4e48\u4f1a\u5f71\u54cd\u7ed3\u679c\u53d8\u91cf\u3002",
      meaning: "\u8fd9\u4e00\u90e8\u5206\u540c\u65f6\u7ed9\u51fa\u4e2d\u4ecb\u673a\u5236\u548c\u8c03\u8282\u673a\u5236\u4e24\u79cd\u5e38\u89c1\u505a\u6cd5\uff1a\u4e2d\u4ecb\u673a\u5236\u7528\u6765\u8bc6\u522b\u4f20\u5bfc\u6e20\u9053\uff0c\u8c03\u8282\u673a\u5236\u7528\u6765\u8bc6\u522b\u5f71\u54cd\u5f3a\u5ea6\u5728\u4ec0\u4e48\u6761\u4ef6\u4e0b\u4f1a\u53d8\u5316\u3002",
      mechanismPaths: [
        "\u4e2d\u4ecb\u673a\u5236\uff1a\u5148\u68c0\u9a8c\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u662f\u5426\u663e\u8457\u5f71\u54cd\u4e2d\u4ecb\u53d8\u91cf\uff0c\u518d\u628a\u4e2d\u4ecb\u53d8\u91cf\u653e\u56de\u4e3b\u56de\u5f52\uff0c\u89c2\u5bdf\u6838\u5fc3\u7cfb\u6570\u662f\u5426\u6536\u7f29\u3002",
        "\u8c03\u8282\u673a\u5236\uff1a\u6784\u9020 \u6838\u5fc3\u89e3\u91ca\u53d8\u91cf \u00d7 \u8c03\u8282\u53d8\u91cf \u7684\u4ea4\u4e92\u9879\uff0c\u68c0\u9a8c\u4e0d\u540c\u6761\u4ef6\u4e0b\u7684\u8fb9\u9645\u6548\u5e94\u662f\u5426\u53d8\u5316\u3002"
      ],
      modelSpec: "\u5148\u505a\u4e2d\u4ecb\u673a\u5236\u4e24\u6b65\u56de\u5f52\uff0c\u518d\u8865\u4e00\u4e2a\u4ea4\u4e92\u9879\u6a21\u578b\u68c0\u9a8c\u8c03\u8282\u6548\u5e94\u3002",
      stataCode: [
        ...baselineInstallLines,
        "",
        ...buildExportNoticeLines(fileName),
        "",
        "* \u8bf7\u628a mediator_var \u66ff\u6362\u6210\u4e2d\u4ecb\u53d8\u91cf\uff0c\u628a moderator_var \u66ff\u6362\u6210\u8c03\u8282\u53d8\u91cf",
        buildReghdfeCommand(
          "mediator_var",
          [aliasBundle.independentAlias, ...aliasBundle.controlAliases],
          buildBaseOptions(fixedEffectAliases, clusterAlias)
        ),
        buildOutregLine(filePath, ExportWriteMode.REPLACE),
        "",
        buildReghdfeCommand(
          aliasBundle.dependentAlias,
          [aliasBundle.independentAlias, "mediator_var", ...aliasBundle.controlAliases],
          buildBaseOptions(fixedEffectAliases, clusterAlias)
        ),
        buildOutregLine(filePath, ExportWriteMode.APPEND),
        "",
        buildReghdfeCommand(
          aliasBundle.dependentAlias,
          [`c.${aliasBundle.independentAlias}##c.moderator_var`, ...aliasBundle.controlAliases],
          buildBaseOptions(fixedEffectAliases, clusterAlias)
        ),
        buildOutregLine(filePath, ExportWriteMode.APPEND)
      ].join("\n"),
      codeExplanation: [
        "\u7b2c\u4e00\u6761\u56de\u5f52\u68c0\u9a8c\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u662f\u5426\u4f1a\u663e\u8457\u5f71\u54cd\u4e2d\u4ecb\u53d8\u91cf\u3002",
        "\u7b2c\u4e8c\u6761\u56de\u5f52\u68c0\u9a8c\u628a\u4e2d\u4ecb\u53d8\u91cf\u653e\u56de\u4e3b\u56de\u5f52\u540e\uff0c\u6838\u5fc3\u7cfb\u6570\u662f\u5426\u51fa\u73b0\u6536\u7f29\u3002",
        "\u7b2c\u4e09\u6761\u56de\u5f52\u7528\u4ea4\u4e92\u9879\u6a21\u578b\u68c0\u9a8c\u8c03\u8282\u6548\u5e94\uff1b\u5982\u679c\u4f60\u7684\u8c03\u8282\u53d8\u91cf\u662f\u7c7b\u522b\u53d8\u91cf\uff0c\u53ef\u4ee5\u628a c. \u6539\u6210 i.\u3002"
      ],
      interpretationGuide: [
        "\u4e2d\u4ecb\u673a\u5236\u91cd\u70b9\u770b\u4e2d\u4ecb\u53d8\u91cf\u662f\u5426\u663e\u8457\uff0c\u4ee5\u53ca\u52a0\u5165\u540e\u6838\u5fc3\u7cfb\u6570\u662f\u5426\u7f29\u5c0f\u3002",
        "\u8c03\u8282\u673a\u5236\u91cd\u70b9\u770b\u4ea4\u4e92\u9879\u662f\u5426\u663e\u8457\uff0c\u4ee5\u53ca\u8fb9\u9645\u6548\u5e94\u5728\u4e0d\u540c\u6761\u4ef6\u4e0b\u662f\u5426\u53d8\u5316\u3002",
        "\u673a\u5236\u5206\u6790\u8981\u56de\u5230\u7406\u8bba\u6e20\u9053\u672c\u8eab\uff0c\u4e0d\u8981\u53ea\u505c\u7559\u5728\u6280\u672f\u6027\u52a0\u53d8\u91cf\u3002"
      ],
      nextSuggestion: "\u660e\u786e\u4f5c\u7528\u6e20\u9053\u540e\uff0c\u53ef\u4ee5\u8fdb\u4e00\u6b65\u628a\u4e2d\u4ecb\u53d8\u91cf\u548c\u8c03\u8282\u53d8\u91cf\u7684\u5b9a\u4e49\u5199\u5f97\u66f4\u7ec6\u3002"
    };
  }

  return {
    ...baseline,
    purpose: "\u5f02\u8d28\u6027\u5206\u6790\u7528\u4e8e\u8bc6\u522b\u4e0d\u540c\u6837\u672c\u7ec4\u4e2d\u6548\u5e94\u662f\u5426\u5b58\u5728\u7cfb\u7edf\u5dee\u5f02\u3002",
    meaning: "\u5e38\u89c1\u505a\u6cd5\u662f\u505a\u5206\u7ec4\u56de\u5f52\uff0c\u6216\u8005\u76f4\u63a5\u6784\u9020\u4ea4\u4e92\u9879\u6bd4\u8f83\u4e0d\u540c\u7ec4\u522b\u7684\u7cfb\u6570\u5dee\u5f02\u3002",
    modelSpec: "\u5148\u5206\u522b\u8dd1\u4e24\u7ec4\u6837\u672c\uff0c\u518d\u7528\u4ea4\u4e92\u9879\u6a21\u578b\u76f4\u63a5\u68c0\u9a8c\u7ec4\u95f4\u7cfb\u6570\u5dee\u5f02\u3002",
    stataCode: [
      ...baselineInstallLines,
      "",
      ...buildExportNoticeLines(fileName),
      "",
      "* \u8bf7\u628a group_var \u66ff\u6362\u6210\u771f\u5b9e\u5206\u7ec4\u53d8\u91cf\uff0c\u4f8b\u5982\u56fd\u6709/\u975e\u56fd\u6709\u3001\u5927\u4f01\u4e1a/\u5c0f\u4f01\u4e1a\u7b49",
      buildReghdfeCommand(
        aliasBundle.dependentAlias,
        [aliasBundle.independentAlias, ...aliasBundle.controlAliases],
        buildBaseOptions(fixedEffectAliases, clusterAlias),
        "if group_var == 1"
      ),
      buildOutregLine(filePath, ExportWriteMode.REPLACE),
      "",
      buildReghdfeCommand(
        aliasBundle.dependentAlias,
        [aliasBundle.independentAlias, ...aliasBundle.controlAliases],
        buildBaseOptions(fixedEffectAliases, clusterAlias),
        "if group_var == 0"
      ),
      buildOutregLine(filePath, ExportWriteMode.APPEND),
      "",
      buildReghdfeCommand(
        aliasBundle.dependentAlias,
        [`c.${aliasBundle.independentAlias}##i.group_var`, ...aliasBundle.controlAliases],
        buildBaseOptions(fixedEffectAliases, clusterAlias)
      ),
      buildOutregLine(filePath, ExportWriteMode.APPEND)
    ].join("\n"),
    codeExplanation: [
      "\u524d\u4e24\u6761\u56de\u5f52\u7528\u4e8e\u5206\u522b\u67e5\u770b\u4e0d\u540c\u7ec4\u522b\u4e2d\u7684\u4e3b\u6548\u5e94\u3002",
      "\u7b2c\u4e09\u6761\u4ea4\u4e92\u9879\u6a21\u578b\u7528\u4e8e\u76f4\u63a5\u68c0\u9a8c\u7ec4\u95f4\u5dee\u5f02\u662f\u5426\u663e\u8457\u3002",
      "\u5f02\u8d28\u6027\u5206\u7ec4\u8981\u6709\u660e\u786e\u7406\u8bba\u4f9d\u636e\uff0c\u907f\u514d\u65e0\u5dee\u522b\u5806\u5206\u7ec4\u3002"
    ],
    interpretationGuide: [
      "\u91cd\u70b9\u6bd4\u8f83\u4e0d\u540c\u7ec4\u522b\u4e2d\u6838\u5fc3\u7cfb\u6570\u7684\u65b9\u5411\u3001\u663e\u8457\u6027\u548c\u91cf\u7ea7\u3002",
      "\u5982\u679c\u4ea4\u4e92\u9879\u663e\u8457\uff0c\u53ef\u4ee5\u8fdb\u4e00\u6b65\u5f3a\u8c03\u5f02\u8d28\u6027\u5b58\u5728\u3002",
      "\u5206\u7ec4\u53e3\u5f84\u6700\u597d\u548c\u8bba\u6587\u7406\u8bba\u673a\u5236\u4fdd\u6301\u4e00\u81f4\u3002"
    ],
    nextSuggestion: "\u5f02\u8d28\u6027\u5206\u6790\u5b8c\u6210\u540e\uff0c\u53ef\u4ee5\u56de\u5230\u8bba\u6587\u7ed3\u6784\u91cc\u6574\u5408\u4e3b\u7ed3\u8bba\u4e0e\u6269\u5c55\u68c0\u9a8c\u3002"
  };
}

export function buildTopicNormalizeOutputTemplate(rawTopic: string): TopicNormalizeOutput {
  const trimmed = rawTopic.trim();
  const cleaned = trimmed.replace(/[\uFF0C\u3002\uFF1B;]+/g, "").trim();
  const match = cleaned.match(/^(.+?)(?:\u5bf9|\u4e0e|\u548c)(.+?)(?:\u7684)?(?:\u5f71\u54cd|\u6548\u5e94|\u5173\u7cfb)(?:\u7814\u7a76)?$/);
  const independentVariable = match?.[1]?.trim() || "";
  const dependentVariable = match?.[2]?.trim() || "";
  const normalizedTopic =
    independentVariable && dependentVariable
      ? `${independentVariable}\u5bf9${dependentVariable}\u7684\u5f71\u54cd\u7814\u7a76`
      : trimmed || "\u7814\u7a76\u4e3b\u9898\u5f85\u8865\u5145";

  return {
    normalizedTopic,
    independentVariable,
    dependentVariable,
    researchObject: "",
    relationship: "\u6b63\u5411\u3001\u8d1f\u5411\u548c\u4e0d\u663e\u8457",
    confirmationMessage: "\u6211\u5df2\u7ecf\u6574\u7406\u51fa\u4e00\u7248\u7814\u7a76\u8bbe\u5b9a\u3002\u5982\u65e0\u95ee\u9898\uff0c\u8bf7\u786e\u8ba4\u5e76\u76f4\u63a5\u751f\u6210\u6574\u5957 Stata \u5de5\u4f5c\u6d41\u3002",
    candidateTopics: normalizedTopic ? [normalizedTopic] : []
  };
}

export function buildGeneralResearchChatFallback(input: GeneralResearchChatInput): GeneralResearchChatOutput {
  const prefix = input.topic ? `\u56f4\u7ed5\u201c${input.topic}\u201d\u8fd9\u9879\u7814\u7a76\uff0c` : "";

  if (/\u56fa\u5b9a\u6548\u5e94/.test(input.userQuestion)) {
    return {
      answer: `${prefix}\u56fa\u5b9a\u6548\u5e94\u7684\u4f5c\u7528\uff0c\u662f\u63a7\u5236\u90a3\u4e9b\u4e0d\u968f\u65f6\u95f4\u53d8\u5316\u3001\u4f46\u4f1a\u7cfb\u7edf\u6027\u5f71\u54cd\u7ed3\u679c\u7684\u9057\u6f0f\u56e0\u7d20\u3002\u5e38\u89c1\u5199\u6cd5\u662f\u52a0\u5165\u4f01\u4e1a\u56fa\u5b9a\u6548\u5e94\u548c\u5e74\u4efd\u56fa\u5b9a\u6548\u5e94\u3002`,
      keyPoints: [
        "\u4f01\u4e1a\u56fa\u5b9a\u6548\u5e94\u7528\u4e8e\u63a7\u5236\u4f01\u4e1a\u5c42\u9762\u4e0d\u968f\u65f6\u95f4\u53d8\u5316\u7684\u7279\u5f81\u3002",
        "\u5e74\u4efd\u56fa\u5b9a\u6548\u5e94\u7528\u4e8e\u63a7\u5236\u5b8f\u89c2\u73af\u5883\u6216\u653f\u7b56\u5e74\u5ea6\u51b2\u51fb\u3002",
        "\u5982\u679c\u7814\u7a76\u5bf9\u8c61\u8de8\u884c\u4e1a\u5dee\u5f02\u660e\u663e\uff0c\u4e5f\u53ef\u4ee5\u8fdb\u4e00\u6b65\u8003\u8651\u884c\u4e1a\u56fa\u5b9a\u6548\u5e94\u3002"
      ],
      suggestedNextActions: ["\u5982\u9700\u6211\u7ee7\u7eed\uff0c\u53ef\u4ee5\u76f4\u63a5\u8ba9\u6211\u8865\u4e00\u7248\u5e26\u56fa\u5b9a\u6548\u5e94\u7684 Stata \u4ee3\u7801\u3002"]
    };
  }

  if (/\u63a7\u5236\u53d8\u91cf/.test(input.userQuestion)) {
    return {
      answer: `${prefix}\u63a7\u5236\u53d8\u91cf\u7684\u6838\u5fc3\u4f5c\u7528\uff0c\u662f\u628a\u90a3\u4e9b\u540c\u65f6\u5f71\u54cd\u89e3\u91ca\u53d8\u91cf\u548c\u88ab\u89e3\u91ca\u53d8\u91cf\u7684\u56e0\u7d20\u7eb3\u5165\u6a21\u578b\uff0c\u51cf\u5c11\u9057\u6f0f\u53d8\u91cf\u504f\u8bef\u3002`,
      keyPoints: [
        "\u63a7\u5236\u53d8\u91cf\u4e00\u822c\u6765\u81ea\u65e2\u6709\u6587\u732e\u7684\u5e38\u89c1\u53e3\u5f84\u3002",
        "\u4f18\u5148\u4fdd\u7559\u6709\u7406\u8bba\u4f9d\u636e\u3001\u4e14\u6570\u636e\u80fd\u7a33\u5b9a\u83b7\u53d6\u7684\u53d8\u91cf\u3002",
        "\u63a7\u5236\u53d8\u91cf\u8fc7\u591a\u4f1a\u589e\u52a0\u5171\u7ebf\u6027\u98ce\u9669\uff0c\u9700\u8981\u7ed3\u5408\u7814\u7a76\u4e3b\u9898\u7b5b\u9009\u3002"
      ],
      suggestedNextActions: ["\u5982\u679c\u4f60\u613f\u610f\uff0c\u6211\u53ef\u4ee5\u6309\u7167\u4f60\u7684\u9898\u76ee\u7ed9\u51fa\u4e00\u7248\u66f4\u5408\u9002\u7684\u63a7\u5236\u53d8\u91cf\u6e05\u5355\u3002"]
    };
  }

  if (/\u6837\u672c\u533a\u95f4|\u65f6\u95f4\u8303\u56f4/.test(input.userQuestion)) {
    return {
      answer: `${prefix}\u6837\u672c\u533a\u95f4\u901a\u5e38\u8981\u540c\u65f6\u8003\u8651\u653f\u7b56\u80cc\u666f\u3001\u6570\u636e\u53ef\u5f97\u6027\u548c\u53d8\u91cf\u53e3\u5f84\u4e00\u81f4\u6027\u3002\u65f6\u95f4\u592a\u77ed\u4f1a\u5f71\u54cd\u8bc6\u522b\uff0c\u65f6\u95f4\u592a\u957f\u53c8\u53ef\u80fd\u9047\u5230\u53e3\u5f84\u53d8\u5316\u3002`,
      keyPoints: [
        "\u5148\u786e\u8ba4\u6838\u5fc3\u6570\u636e\u6e90\u4ece\u54ea\u4e00\u5e74\u5f00\u59cb\u7a33\u5b9a\u53ef\u5f97\u3002",
        "\u6837\u672c\u671f\u6700\u597d\u8986\u76d6\u653f\u7b56\u524d\u540e\u6216\u5173\u952e\u5236\u5ea6\u53d8\u5316\u9636\u6bb5\u3002",
        "\u5982\u679c\u4e2d\u9014\u53d8\u91cf\u53e3\u5f84\u53d1\u751f\u53d8\u5316\uff0c\u9700\u8981\u5355\u72ec\u8bf4\u660e\u5904\u7406\u65b9\u5f0f\u3002"
      ],
      suggestedNextActions: ["\u5982\u679c\u4f60\u628a\u6570\u636e\u6765\u6e90\u544a\u8bc9\u6211\uff0c\u6211\u53ef\u4ee5\u5e2e\u4f60\u5224\u65ad\u6837\u672c\u533a\u95f4\u662f\u5426\u5408\u9002\u3002"]
    };
  }

  return {
    answer: `${prefix}\u6211\u53ef\u4ee5\u7ee7\u7eed\u5e2e\u4f60\u89e3\u91ca\u5f53\u524d\u6a21\u5757\u7684\u903b\u8f91\u3001\u8865\u5168\u53d8\u91cf\u8bbe\u5b9a\uff0c\u6216\u8005\u628a\u67d0\u4e00\u6bb5 Stata \u4ee3\u7801\u6539\u5f97\u66f4\u7ec6\u3002`,
    keyPoints: [
      "\u4f60\u53ef\u4ee5\u7ee7\u7eed\u8ffd\u95ee\u5f53\u524d\u6a21\u5757\u7684\u7406\u8bba\u542b\u4e49\u3002",
      "\u4e5f\u53ef\u4ee5\u8ba9\u6211\u76f4\u63a5\u8865\u4e00\u7248\u66f4\u8be6\u7ec6\u7684\u4ee3\u7801\u6a21\u677f\u3002",
      "\u5982\u679c\u7814\u7a76\u8bbe\u5b9a\u6709\u53d8\u5316\uff0c\u6211\u4e5f\u53ef\u4ee5\u5148\u5e2e\u4f60\u91cd\u6574\u6458\u8981\u518d\u91cd\u65b0\u751f\u6210\u3002"
    ],
    suggestedNextActions: ["\u76f4\u63a5\u544a\u8bc9\u6211\u4f60\u60f3\u7ee7\u7eed\u8ffd\u95ee\u54ea\u4e00\u90e8\u5206\u3002"]
  };
}

export function buildResultInterpretFallback(input: ResultInterpretInput): ResultInterpretOutput {
  const significant = /\*\*\*|\*\*|\*|p\s*</i.test(input.resultText);
  return {
    plainExplanation: significant
      ? "\u4ece\u5f53\u524d\u7ed3\u679c\u770b\uff0c\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u4e0e\u88ab\u89e3\u91ca\u53d8\u91cf\u4e4b\u95f4\u5b58\u5728\u7edf\u8ba1\u4e0a\u663e\u8457\u7684\u5173\u7cfb\uff0c\u53ef\u4ee5\u5148\u4ece\u65b9\u5411\u3001\u663e\u8457\u6027\u548c\u7ecf\u6d4e\u610f\u4e49\u4e09\u65b9\u9762\u5c55\u5f00\u89e3\u91ca\u3002"
      : "\u4ece\u5f53\u524d\u7ed3\u679c\u770b\uff0c\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u4e0e\u88ab\u89e3\u91ca\u53d8\u91cf\u4e4b\u95f4\u6682\u65f6\u6ca1\u6709\u5f62\u6210\u7a33\u5b9a\u663e\u8457\u7684\u7edf\u8ba1\u5173\u7cfb\uff0c\u9700\u8981\u8fdb\u4e00\u6b65\u68c0\u67e5\u6a21\u578b\u8bbe\u5b9a\u4e0e\u53d8\u91cf\u53e3\u5f84\u3002",
    paperStyleExplanation: significant
      ? "\u56de\u5f52\u7ed3\u679c\u8868\u660e\uff0c\u5728\u63a7\u5236\u76f8\u5173\u53d8\u91cf\u548c\u56fa\u5b9a\u6548\u5e94\u540e\uff0c\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u7684\u4f30\u8ba1\u7cfb\u6570\u4ecd\u7136\u663e\u8457\uff0c\u8bf4\u660e\u8be5\u53d8\u91cf\u5bf9\u88ab\u89e3\u91ca\u53d8\u91cf\u5177\u6709\u7a33\u5b9a\u5f71\u54cd\u3002"
      : "\u56de\u5f52\u7ed3\u679c\u663e\u793a\uff0c\u5728\u5f53\u524d\u6a21\u578b\u8bbe\u5b9a\u4e0b\uff0c\u6838\u5fc3\u89e3\u91ca\u53d8\u91cf\u7684\u4f30\u8ba1\u7cfb\u6570\u672a\u8fbe\u5230\u5e38\u89c4\u663e\u8457\u6027\u6c34\u5e73\uff0c\u8bf4\u660e\u5176\u5f71\u54cd\u5c1a\u7f3a\u4e4f\u7a33\u5b9a\u7edf\u8ba1\u8bc1\u636e\u3002",
    analysisPoints: [
      "\u5148\u770b\u7cfb\u6570\u65b9\u5411",
      "\u518d\u770b\u663e\u8457\u6027\u6c34\u5e73",
      "\u7ed3\u5408\u7ecf\u6d4e\u542b\u4e49\u89e3\u91ca",
      "\u6bd4\u8f83\u4e0d\u540c\u6a21\u578b\u89c4\u683c",
      "\u68c0\u67e5\u7a33\u5065\u6027\u4e0e\u5185\u751f\u6027"
    ],
    missingInfo: [],
    nextSuggestion: "\u5982\u679c\u4f60\u628a\u5b8c\u6574\u56de\u5f52\u8868\u8d34\u7ed9\u6211\uff0c\u6211\u53ef\u4ee5\u7ee7\u7eed\u5e2e\u4f60\u5199\u6210\u8bba\u6587\u5f0f\u7ed3\u679c\u89e3\u8bfb\u3002"
  };
}

export function buildStataErrorFallback(input: StataErrorDebugInput): StataErrorDebugOutput {
  const errorText = input.errorText.toLowerCase();

  if (errorText.includes("not found") || errorText.includes("command")) {
    return {
      errorType: "command_not_found",
      explanation: "\u8fd9\u4e2a\u62a5\u9519\u901a\u5e38\u8bf4\u660e\u5bf9\u5e94\u547d\u4ee4\u8fd8\u6ca1\u6709\u5b89\u88c5\uff0c\u6216\u8005\u5f53\u524d\u73af\u5883\u6ca1\u6709\u6b63\u786e\u8bc6\u522b\u7528\u6237\u81ea\u88c5\u547d\u4ee4\u3002",
      fixCode: [
        "* 如果你以前没安装过 reghdfe、ftools 和 outreg2，请先运行下面三行；安装过的话可以直接忽略，或者用 Ctrl+/ 注释掉",
        "ssc install reghdfe, replace",
        "ssc install ftools, replace",
        "ssc install outreg2, replace"
      ].join("\n"),
      retryMessage: "\u5b89\u88c5\u5b8c\u6210\u540e\uff0c\u518d\u91cd\u65b0\u8fd0\u884c\u539f\u6765\u7684\u56de\u5f52\u547d\u4ee4\u5373\u53ef\u3002"
    };
  }

  if (errorText.includes("variable") || errorText.includes("ambiguous abbreviation")) {
    return {
      errorType: "variable_not_found",
      explanation: "\u8fd9\u4e2a\u62a5\u9519\u901a\u5e38\u8bf4\u660e\u53d8\u91cf\u540d\u5199\u9519\u4e86\uff0c\u6216\u8005\u5f53\u524d\u6570\u636e\u96c6\u4e2d\u6839\u672c\u6ca1\u6709\u8be5\u53d8\u91cf\u3002",
      fixCode: ["describe", "lookfor variable_name"].join("\\n"),
      retryMessage: "\u5148\u786e\u8ba4\u53d8\u91cf\u7684\u771f\u5b9e\u5b57\u6bb5\u540d\uff0c\u518d\u628a\u4ee3\u7801\u91cc\u7684\u53d8\u91cf\u540d\u66ff\u6362\u6210\u6b63\u786e\u5199\u6cd5\u3002"
    };
  }

  return {
    errorType: "stata_error",
    explanation: "\u6211\u5df2\u7ecf\u5148\u6839\u636e\u8fd9\u6bb5\u62a5\u9519\u7ed9\u51fa\u4e00\u7248\u901a\u7528\u6392\u67e5\u601d\u8def\uff0c\u5efa\u8bae\u4f60\u4f18\u5148\u68c0\u67e5\u53d8\u91cf\u540d\u3001\u547d\u4ee4\u5b89\u88c5\u548c\u62ec\u53f7\u5199\u6cd5\u3002",
    fixCode: input.relatedCode || "\u8bf7\u628a\u89e6\u53d1\u62a5\u9519\u7684\u5b8c\u6574 Stata \u4ee3\u7801\u4e00\u8d77\u8d34\u7ed9\u6211\uff0c\u6211\u4f1a\u7ee7\u7eed\u9010\u884c\u6392\u67e5\u3002",
    retryMessage: "\u5982\u679c\u8fd8\u6709\u62a5\u9519\uff0c\u628a\u5b8c\u6574\u62a5\u9519\u4fe1\u606f\u548c\u4e0a\u4e0b\u6587\u4ee3\u7801\u53d1\u7ed9\u6211\uff0c\u6211\u4f1a\u7ee7\u7eed\u5e2e\u4f60\u5b9a\u4f4d\u3002"
  };
}
