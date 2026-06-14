import { SkillName, WorkflowStep } from "@empirical/shared";
import { SkillsService } from "./skills.service";

describe("deterministic workflow skills", () => {
  it("generates workflow code without calling the LLM", async () => {
    const prisma = {
      project: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: "project-1",
          title: "测试项目",
          topicRaw: "数字化转型对企业绩效的影响",
          topicNormalized: "数字化转型对企业绩效的影响研究",
          currentStep: WorkflowStep.DATA_CLEANING,
          status: "ACTIVE",
          researchSummary: null,
          lastSkillName: null,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      },
      skillRun: {
        create: jest.fn().mockResolvedValue({ id: "skill-run-1" })
      },
      codeBlock: {
        create: jest.fn().mockResolvedValue({ id: "code-1" })
      }
    };
    const promptService = {
      getSkillPrompt: jest.fn().mockResolvedValue({ version: "test", template: "{{input}}" }),
      getSystemPrompt: jest.fn().mockResolvedValue("system"),
      renderPrompt: jest.fn().mockReturnValue("{}")
    };
    const llmService = {
      modelName: "test-model",
      generateJson: jest.fn(),
      generateToolCall: jest.fn()
    };
    const researchProfileService = {
      getByProjectId: jest.fn().mockResolvedValue(null)
    };
    const messagesService = {
      getRecentMessages: jest.fn().mockResolvedValue([])
    };
    const projectsService = {
      mapProject: jest.fn((project) => project)
    };
    const harnessService = {
      authorizeTool: jest.fn().mockReturnValue({ decision: "allow", reason: "allowed" }),
      recordToolResult: jest.fn().mockResolvedValue({})
    };
    const service = new SkillsService(
      prisma as never,
      promptService as never,
      llmService as never,
      {} as never,
      researchProfileService as never,
      messagesService as never,
      projectsService as never,
      harnessService as never
    );

    const result = await service.executeSkill({
      projectId: "project-1",
      skillName: SkillName.DATA_CLEANING,
      step: WorkflowStep.DATA_CLEANING,
      payload: {
        dependentVariable: "绩效",
        independentVariable: "数字化转型",
        controls: ["规模", "杠杆率"],
        panelId: "firm_id",
        timeVar: "year"
      }
    });

    expect(result.data.stataCode).toContain("destring");
    expect(llmService.generateJson).not.toHaveBeenCalled();
    expect(llmService.generateToolCall).not.toHaveBeenCalled();
    expect(result.fallbackUsed).toBe(false);
    expect(prisma.skillRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          model: "deterministic",
          status: "deterministic"
        })
      })
    );
  });
});
