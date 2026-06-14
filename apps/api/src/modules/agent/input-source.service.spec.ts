import { InputSourceService } from "./input-source.service";

function createService() {
  const artifacts: Array<Record<string, any>> = [];
  const prisma = {
    agentArtifact: {
      findMany: jest.fn(async () => artifacts.slice().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()))
    }
  };
  const harnessService = {
    createTextArtifact: jest.fn(async (input: Record<string, any>) => {
      const id = `artifact-${artifacts.length + 1}`;
      artifacts.push({
        id,
        projectId: input.projectId,
        runId: input.runId,
        kind: input.kind,
        name: input.name,
        mimeType: input.mimeType,
        sizeBytes: Buffer.byteLength(input.contentText, "utf8"),
        contentPreview: input.contentText.slice(0, 1800),
        contentText: input.contentText,
        metadataJson: input.metadata,
        createdAt: new Date(Date.UTC(2026, 0, artifacts.length + 1))
      });
      return {
        id,
        preview: input.contentText.slice(0, 1800),
        reference: `artifact:${id}`
      };
    })
  };

  return {
    service: new InputSourceService(prisma as never, harnessService as never),
    artifacts,
    prisma,
    harnessService
  };
}

describe("InputSourceService", () => {
  it("stores each submitted source independently and builds a compact source index", async () => {
    const { service, artifacts } = createService();

    const result = await service.prepareTurnContext({
      projectId: "project-1",
      runId: "run-1",
      userMessage: "请根据我的材料提取研究设定",
      payload: {
        inputSources: [
          {
            sourceType: "user_text",
            text: "我的论文研究数字金融对企业创新的影响。"
          },
          {
            sourceType: "document",
            fileName: "开题报告.docx",
            text: "研究主题、变量设定、模型设定、样本区间、固定效应。".repeat(1200)
          },
          {
            sourceType: "spreadsheet",
            fileName: "变量字典.xlsx",
            text: "工作表：变量说明\n变量名 | 含义\nroa | 资产收益率"
          }
        ]
      }
    });

    expect(artifacts).toHaveLength(3);
    expect(result.sourceArtifactIds).toEqual(["artifact-1", "artifact-2", "artifact-3"]);
    expect(result.sourceContextText).toContain("开题报告.docx");
    expect(result.sourceContextText).toContain("变量字典.xlsx");

    const index = await service.buildProjectSourceIndex("project-1");
    expect(index).toContain("source_");
    expect(index).toContain("开题报告.docx");
    expect(index).toContain("变量字典.xlsx");
  });

  it("recalls prior long-document chunks by source id and query", async () => {
    const { service, artifacts } = createService();
    await service.prepareTurnContext({
      projectId: "project-1",
      userMessage: "请阅读附件",
      payload: {
        inputSources: [{
          sourceType: "document",
          fileName: "开题报告.docx",
          text: "变量设定、模型设定、样本区间、控制变量、固定效应。".repeat(1400)
        }]
      }
    });

    const sourceId = artifacts[0].metadataJson.sourceId;
    const recalled = await service.recallSources({
      projectId: "project-1",
      sourceIds: [sourceId],
      query: "变量 模型 样本",
      maxChunks: 5
    }) as Record<string, any>;

    expect(recalled.ok).toBe(true);
    expect(recalled.sources).toHaveLength(1);
    expect(recalled.sources[0].mode).toBe("recalled_chunks");
    expect(recalled.sources[0].chunks.length).toBeLessThanOrEqual(5);
    expect(recalled.sources[0].chunks[0].text).toContain("变量设定");
  });
});
