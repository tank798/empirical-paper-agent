import { inferProfileUpdates } from "./skill.utils";

describe("research setup extraction", () => {
  it("extracts a complete long-form research setup without enabling unsupported methods", () => {
    const text = `我想研究企业创新对ESG表现的影响。

本文选择2009到2023年沪深A股上市公司为研究样本，删除金融类企业、ST类企业以及主要变量缺失的样本。被解释变量为企业ESG表现，采用华证ESG评级作为企业ESG表现的代理变量。核心解释变量为企业创新水平，采用企业当年专利申请总数加1后取自然对数作为代理变量。

机制变量方面，我想检验企业创新是否通过缓解融资约束和提高企业风险承担水平影响ESG表现。其中，融资约束可以用企业新增负债占总资产比例的倒数作为企业信贷获得难度 Credit 的代理变量；企业风险承担可以参考三年滚动窗口内经行业调整后的ROA标准差乘以100得到 Risk1，也可以使用企业年化日收益率标准差的对数得到 Risk2。

控制变量包括企业年龄的对数 Age、企业总市值的对数 Size、固定资产比率 Fixed、营业收入增长率 Growth、现金比率 Cash、独立董事占董事会比例 Prop、机构投资者持股比例 Ins、是否两职合一 Duality、第一大股东持股比例 Big、行业竞争性 HHI、企业所处省份市场化程度 Market。

固定效应采用企业固定效应和年份固定效应。面板个体变量为 stkcd，时间变量为 year。标准误按公司个体层面聚类，也就是按 stkcd 聚类。暂时不做DID、PSM和工具变量法。`;

    const result = inferProfileUpdates(text);

    expect(result).toMatchObject({
      normalizedTopic: "企业创新对ESG表现的影响研究",
      independentVariable: "企业创新水平",
      dependentVariable: "企业ESG表现",
      sampleScope: "2009–2023年",
      fixedEffects: ["企业固定效应", "年份固定效应"],
      panelId: "stkcd",
      timeVar: "year",
      clusterVar: "stkcd",
      didEnabled: false,
      psmEnabled: false,
      instrumentVariable: null
    });
    expect(result.controls).toEqual(["Age", "Size", "Fixed", "Growth", "Cash", "Prop", "Ins", "Duality", "Big", "HHI", "Market"]);
    expect(result.mechanismVariables).toEqual(["Credit", "Risk1", "Risk2"]);
    expect(JSON.stringify(result)).not.toContain("treat");
    expect(JSON.stringify(result)).not.toContain("2011");
  });

  it("normalizes noisy PDF text before extracting variables", () => {
    const text = `题 目 企业创新对 ESG ——表现的影响 基于融资约束与风险承担机制的视角
样本区间 2009-2025 年
本文以 2009 到 2025 年 深沪 A 股上市公司为研究样本，剔除金融类企业、ST 类企业以及主要变量
缺失样本，考察企业创新水平对企业 ESG 表现的影响。
被解释变量为企业 ESG 表
现，采用华证 ESG 评级作为代理变量；核心解释变量为企业创新水平。
控制变量包括企业年龄的对数 Age、企业规模 Size、资产负债率 Lev、营
业收入增长率 Growth、现金比率 Cash、固定资产比率 Fixed、董事会规模 Board、独立董事比例
Indep、第一大股东持股比例 Top1、企业所在地区市场化程度 Market。
2025 年 12 月 10 日
研究方法 面板双向固定效应、机制检验、稳健性检验`;

    const result = inferProfileUpdates(text);

    expect(result.dependentVariable).toBe("企业ESG表现");
    expect(result.researchObject).toContain("沪深A股上市公司");
    expect(result.sampleScope).toBe("2009–2025年");
    expect(result.controls).toEqual(["Age", "Size", "Lev", "Growth", "Cash", "Fixed", "Board", "Indep", "Top1", "Market"]);
    expect(result.fixedEffects).toEqual(["企业固定效应", "年份固定效应"]);
  });

  it("does not turn opening-report prose into fake fixed effects", () => {
    const text = `本文以2009到2025年沪深A股上市公司为研究样本，剔除金融类企业、ST类企业以及主要变量缺失样本，考察企业创新水平对企业ESG表现的影响。
第三，基于中国A股上市公司样本，结合企业固定效应和年份固定效应控制不可观测因素，为企业创新投入和ESG治理实践提供经验证据。
本文采用面板双向固定效应模型进行基准回归，在控制企业固定效应和年份固定效应的基础上，检验企业创新水平对企业ESG表现的影响。`;

    const result = inferProfileUpdates(text);

    expect(result.fixedEffects).toEqual(["企业固定效应", "年份固定效应"]);
    expect(result.fixedEffects).not.toContain("ESG治理实践提供经验证据固定效应");
  });

  it("uses spreadsheet dictionary and description text to map variable roles", () => {
    const text = `工作表：变量字典
字段名 | 中文含义 | 建议角色 | 期望识别说明
stkcd | 股票代码/公司代码 | 面板个体变量、聚类变量 | 若用户明确说明，可识别为 panelId；聚类变量可默认 stkcd。
year | 年份 | 时间变量 | 用户明确说明时识别为 timeVar。
ESG | 企业ESG表现，华证ESG评级 | 被解释变量 | dependentVariable。
Innov | 企业创新水平，专利申请数量加1取对数 | 解释变量 | independentVariable。
Credit | 企业信贷获得难度 | 机制变量 | 融资约束机制变量。
Risk1 | 三年滚动ROA波动率乘以100 | 机制变量 | 风险承担机制变量。
Risk2 | 企业年化日收益率标准差的对数 | 机制变量 | 风险承担机制变量。
Age | 企业年龄的对数 | 控制变量 | controls
Size | 企业规模 | 控制变量 | controls
Lev | 资产负债率 | 控制变量 | controls
Growth | 营业收入增长率 | 控制变量 | controls
Cash | 现金比率 | 控制变量 | controls
Fixed | 固定资产比率 | 控制变量 | controls
Board | 董事会规模 | 控制变量 | controls
Indep | 独立董事比例 | 控制变量 | controls
Top1 | 第一大股东持股比例 | 控制变量 | controls
Market | 企业所在地区市场化程度 | 控制变量 | controls

工作表：测试说明
测试主题 | 企业创新对ESG表现的影响
样本设定 | 2009-2025年沪深A股上市公司
固定效应 | 企业固定效应、年份固定效应
面板个体变量 | 用户明确说明时为 stkcd
时间变量 | 用户明确说明时为 year
聚类变量 | 可默认 stkcd`;

    const result = inferProfileUpdates(text);

    expect(result.normalizedTopic).toBe("企业创新对ESG表现的影响研究");
    expect(result.independentVariable).toBe("Innov");
    expect(result.dependentVariable).toBe("ESG");
    expect(result.controls).toEqual(["Age", "Size", "Lev", "Growth", "Cash", "Fixed", "Board", "Indep", "Top1", "Market"]);
    expect(result.mechanismVariables).toEqual(["Credit", "Risk1", "Risk2"]);
    expect(result.fixedEffects).toEqual(["企业固定效应", "年份固定效应"]);
    expect(result.panelId).toBe("stkcd");
    expect(result.timeVar).toBe("year");
  });
});
