import {
  SOURCE_CHUNK_OVERLAP,
  SOURCE_CHUNK_SIZE,
  assessLongSourceRelevance,
  prepareInputSource,
  selectRelevantChunks,
  splitTextIntoChunks,
  trimHeadTail
} from "./input-source.utils";

describe("input source context utilities", () => {
  it("trims long history messages by keeping the head and tail", () => {
    const value = "a".repeat(600) + "middle" + "z".repeat(600);
    const trimmed = trimHeadTail(value, 1000, 500, 500);

    expect(trimmed.startsWith("a".repeat(500))).toBe(true);
    expect(trimmed).toContain("[中间省略]");
    expect(trimmed.endsWith("z".repeat(500))).toBe(true);
  });

  it("splits long text into 1500-character chunks with 200-character overlap", () => {
    const chunks = splitTextIntoChunks("研".repeat(3800));

    expect(chunks[0]).toMatchObject({ start: 0, end: SOURCE_CHUNK_SIZE });
    expect(chunks[1].start).toBe(SOURCE_CHUNK_SIZE - SOURCE_CHUNK_OVERLAP);
    expect(chunks.length).toBe(3);
  });

  it("prechecks unrelated long text without chunking it into the prompt", () => {
    const unrelated = "购物清单、电影台词、随机闲聊。".repeat(2500);
    const prepared = prepareInputSource({
      sourceId: "source_unrelated",
      sourceType: "document",
      fileName: "random.txt",
      text: unrelated
    });

    expect(assessLongSourceRelevance(unrelated).level).toBe("low");
    expect(prepared.mode).toBe("low_relevance_preview");
    expect(prepared.selectedChunks).toHaveLength(0);
    expect(prepared.contextText).not.toContain(unrelated.slice(4000, 7000));
  });

  it("retrieves at most 20 scored chunks from relevant long text", () => {
    const relevant = Array.from({ length: 40 }, (_, index) =>
      `第${index + 1}节 变量设定与模型设定。本文研究企业创新，包含变量、样本区间、控制变量、固定效应、基准回归和稳健性检验。${"内容".repeat(120)}`
    ).join("\n");
    const chunks = selectRelevantChunks(relevant);

    expect(chunks.length).toBeLessThanOrEqual(20);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].matchedKeywords).toEqual(expect.arrayContaining(["变量", "模型"]));
    expect(chunks).toEqual([...chunks].sort((a, b) => a.index - b.index));
  });

  it("keeps spreadsheet sources as structured spreadsheet context instead of text chunking", () => {
    const prepared = prepareInputSource({
      sourceId: "source_excel",
      sourceType: "spreadsheet",
      fileName: "变量字典.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      text: "工作表：变量说明\n变量名 | 含义 | 类型\nroa | 资产收益率 | numeric\nsize | 企业规模 | numeric"
    });

    expect(prepared.mode).toBe("spreadsheet");
    expect(prepared.selectedChunks).toHaveLength(0);
    expect(prepared.contextText).toContain("表格结构化预览");
  });
});
