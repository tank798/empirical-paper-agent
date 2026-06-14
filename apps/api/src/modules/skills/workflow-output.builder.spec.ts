import { SkillName } from "@empirical/shared";
import { DATA_CLEANING_INSTALL_LINES, DATA_CLEANING_INSTALL_PACKAGES } from "./stata-code.config";
import { buildDataCleaningOutputTemplate, buildRegressionModuleOutput } from "./workflow-output.builder";

const dataCleaningInput = {
  dependentVariable: "企业绩效",
  independentVariable: "数字化转型",
  controls: ["企业规模", "资产负债率"],
  needLogVars: [],
  fixedEffects: ["企业固定效应", "年份固定效应"],
  clusterVar: "firm_id",
  panelId: "firm_id",
  timeVar: "year",
  sampleScope: "2010-2024",
  termMappings: []
};

const regressionInput = {
  ...dataCleaningInput,
  didEnabled: true,
  psmEnabled: true,
  treatmentVar: "treat",
  policyStartYear: "2018",
  instrumentVariable: "iv_var",
  psmMatchVars: ["size", "lev"],
  mechanismVariables: ["mediator", "moderator"],
  heterogeneityVars: ["group"],
  exportFormats: ["word" as const]
};

const expectedInstallPackageNames = [
  "reghdfe",
  "ftools",
  "ivreg2",
  "ranktest",
  "ivreghdfe",
  "ppmlhdfe",
  "csdid",
  "drdid",
  "did_imputation",
  "eventstudyinteract",
  "sdid",
  "did_multiplegt_dyn",
  "bacondecomp",
  "honestdid",
  "rdrobust",
  "rddensity",
  "synth",
  "synth_runner",
  "psmatch2",
  "ebalance",
  "boottest",
  "ritest",
  "rwolf",
  "psacalc",
  "coefplot",
  "estout",
  "outreg2",
  "asdoc",
  "binscatter",
  "balancetable",
  "winsor2",
  "schemepack",
  "heatplot",
  "palettes",
  "colrspace",
  "mdesc",
  "missings",
  "unique",
  "moremata"
] as const;

describe("Stata workflow output builder", () => {
  it("puts one annotated install block at the top of data cleaning", () => {
    const output = buildDataCleaningOutputTemplate(dataCleaningInput);
    const lines = output.stataCode.split("\n");
    const installLines = lines.filter((line) => line.startsWith("ssc install "));
    const packageNames = DATA_CLEANING_INSTALL_PACKAGES.map(({ name }) => name);

    expect(lines.slice(0, DATA_CLEANING_INSTALL_LINES.length)).toEqual([...DATA_CLEANING_INSTALL_LINES]);
    expect(installLines).toEqual([...DATA_CLEANING_INSTALL_LINES]);
    expect(new Set(installLines).size).toBe(installLines.length);
    expect(packageNames).toEqual(expectedInstallPackageNames);
    expect(new Set(packageNames).size).toBe(packageNames.length);
    installLines.forEach((line) => expect(line).toMatch(/ \/\/ .+：安装 .+，.+/));
    expect(output.purpose).toContain("安装");
    expect(output.variableDesign[0]).toContain("集中安装");
  });

  it.each([
    [SkillName.BASELINE_REGRESSION, "基准回归", "baseline"],
    [SkillName.ROBUSTNESS, "稳健性检验", "robustness"],
    [SkillName.IV, "内生性分析", "iv"],
    [SkillName.MECHANISM, "机制分析", "mechanism"],
    [SkillName.HETEROGENEITY, "异质性分析", "heterogeneity"]
  ] as const)("keeps installs out of %s and uses a relative results directory", (moduleName, label, variant) => {
    const output = buildRegressionModuleOutput(moduleName, regressionInput, label, variant);

    expect(output.stataCode).not.toContain("ssc install");
    expect(output.stataCode).not.toContain("D:\\results");
    expect(output.stataCode).toContain('capture mkdir "results"');
    expect(output.stataCode).toContain('outreg2 using "results/');
  });
});
