export const STATA_RESULTS_DIRECTORY = "results";

export const DATA_CLEANING_INSTALL_PACKAGES = [
  { category: "核心命令", name: "reghdfe", description: "执行高维固定效应回归" },
  { category: "核心命令", name: "ftools", description: "为 reghdfe 和 ivreghdfe 提供高效分组计算支持" },
  { category: "核心命令", name: "ivreg2", description: "执行工具变量回归并提供弱识别等诊断" },
  { category: "核心命令", name: "ranktest", description: "为 ivreg2 和 ivreghdfe 提供秩与弱识别检验" },
  { category: "核心命令", name: "ivreghdfe", description: "执行带高维固定效应的工具变量回归" },
  { category: "核心命令", name: "ppmlhdfe", description: "执行带高维固定效应的泊松伪极大似然回归" },
  { category: "DID 与事件研究", name: "csdid", description: "估计多期错位处理下的 Callaway-Sant'Anna DID" },
  { category: "DID 与事件研究", name: "drdid", description: "估计双重稳健 DID" },
  { category: "DID 与事件研究", name: "did_imputation", description: "使用插补法估计多期 DID 和事件研究效应" },
  { category: "DID 与事件研究", name: "eventstudyinteract", description: "执行 Sun-Abraham 交互加权事件研究" },
  { category: "DID 与事件研究", name: "sdid", description: "执行合成双重差分估计" },
  { category: "DID 与事件研究", name: "did_multiplegt_dyn", description: "估计动态、多期和异质处理效应 DID" },
  { category: "DID 与事件研究", name: "bacondecomp", description: "分解双向固定效应 DID 的 Bacon 权重" },
  { category: "DID 与事件研究", name: "honestdid", description: "评估平行趋势偏离下 DID 结论的敏感性" },
  { category: "RD、SCM 与匹配", name: "rdrobust", description: "执行稳健回归不连续估计与推断" },
  { category: "RD、SCM 与匹配", name: "rddensity", description: "检验断点附近运行变量密度和操纵风险" },
  { category: "RD、SCM 与匹配", name: "synth", description: "执行经典合成控制法" },
  { category: "RD、SCM 与匹配", name: "synth_runner", description: "批量运行合成控制、安慰剂和推断流程" },
  { category: "RD、SCM 与匹配", name: "psmatch2", description: "执行倾向得分匹配" },
  { category: "RD、SCM 与匹配", name: "ebalance", description: "使用熵平衡构造协变量平衡权重" },
  { category: "稳健性与推断", name: "boottest", description: "执行野生聚类自助法检验" },
  { category: "稳健性与推断", name: "ritest", description: "执行随机化推断和置换检验" },
  { category: "稳健性与推断", name: "rwolf", description: "执行 Romano-Wolf 多重假设检验校正" },
  { category: "稳健性与推断", name: "psacalc", description: "使用系数稳定性评估遗漏变量偏误" },
  { category: "表格与图形", name: "coefplot", description: "绘制回归系数和置信区间图" },
  { category: "表格与图形", name: "estout", description: "使用 esttab 和 estout 整理并导出估计结果" },
  { category: "表格与图形", name: "outreg2", description: "导出回归结果表" },
  { category: "表格与图形", name: "asdoc", description: "将统计结果和表格导出到 Word" },
  { category: "表格与图形", name: "binscatter", description: "绘制分箱散点图和拟合关系" },
  { category: "表格与图形", name: "balancetable", description: "生成处理组与对照组的协变量平衡表" },
  { category: "表格与图形", name: "winsor2", description: "对连续变量进行缩尾处理" },
  { category: "表格与图形", name: "schemepack", description: "提供可用于论文图形的 Stata 绘图主题" },
  { category: "表格与图形", name: "heatplot", description: "绘制热力图" },
  { category: "表格与图形", name: "palettes", description: "提供可复用的颜色与符号调色板" },
  { category: "表格与图形", name: "colrspace", description: "提供颜色空间转换与颜色生成工具" },
  { category: "辅助工具", name: "mdesc", description: "汇总并展示变量缺失情况" },
  { category: "辅助工具", name: "missings", description: "检查、报告和管理缺失值" },
  { category: "辅助工具", name: "unique", description: "统计变量或变量组合的唯一值数量" },
  { category: "辅助工具", name: "moremata", description: "提供多个命令依赖的 Mata 扩展函数" }
] as const;

export const DATA_CLEANING_INSTALL_LINES = DATA_CLEANING_INSTALL_PACKAGES.map(
  ({ category, name, description }) => `ssc install ${name}, replace // ${category}：安装 ${name}，${description}`
);
