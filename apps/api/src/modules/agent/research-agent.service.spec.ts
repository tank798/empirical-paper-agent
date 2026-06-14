import { AssistantMessageType, WorkflowStep } from "@empirical/shared";
import { ResearchAgentService } from "./research-agent.service";

function createService(options?: {
  llmResponses?: Array<Record<string, unknown>>;
  updateResult?: Record<string, unknown>;
}) {
  const projectsService = {
    assertProjectAccess: jest.fn().mockResolvedValue({
      id: "project-1",
      currentStep: WorkflowStep.TOPIC_NORMALIZE
    })
  };
  let messageCount = 0;
  const messagesService = {
    getRecentMessages: jest.fn().mockResolvedValue([]),
    createMessage: jest.fn(async (input: Record<string, unknown>) => {
      messageCount += 1;
      return {
        id: `message-${messageCount}`,
        ...input,
        createdAt: new Date().toISOString()
      };
    })
  };
  const researchProfileService = {
    getByProjectId: jest.fn().mockResolvedValue(null)
  };
  const promptService = {
    getResearchAgentPrompt: jest.fn().mockResolvedValue("research agent prompt")
  };
  const llmResponses = options?.llmResponses ?? [];
  const llmService = {
    generateAgentResponse: jest.fn().mockImplementation(async () => llmResponses.shift())
  };
  const harnessService = {
    budgetUserMessage: jest.fn(async ({ userMessage }) => ({ userMessage, artifactIds: [] })),
    authorizeTool: jest.fn().mockReturnValue({ decision: "allow", reason: "allowed" }),
    recordToolResult: jest.fn().mockResolvedValue({}),
    recordEvent: jest.fn().mockResolvedValue({})
  };
  const workflowService = {
    updateResearchProfileFromAgent: jest.fn().mockResolvedValue(
      options?.updateResult ?? {
        ok: true,
        changedFields: ["dependentVariable"],
        missingFields: [],
        missingFieldLabels: [],
        setupComplete: true,
        researchProfile: {
          dependentVariable: "ROA"
        },
        currentStep: WorkflowStep.TOPIC_NORMALIZE
      }
    )
  };

  return {
    service: new ResearchAgentService(
      projectsService as never,
      messagesService as never,
      researchProfileService as never,
      promptService as never,
      llmService as never,
      harnessService as never,
      workflowService as never
    ),
    messagesService,
    llmService,
    harnessService,
    workflowService
  };
}

describe("ResearchAgentService", () => {
  it("answers a research question directly without executing a tool", async () => {
    const { service, llmService, workflowService, messagesService } = createService({
      llmResponses: [{
        content: "固定效应用于控制不随时间变化的个体异质性。",
        toolCalls: [],
        assistantMessage: {
          role: "assistant",
          content: "固定效应用于控制不随时间变化的个体异质性。"
        }
      }]
    });

    const result = await service.handleTurn({
      projectId: "project-1",
      resumeToken: "token",
      userMessage: "固定效应是什么？"
    });

    expect(llmService.generateAgentResponse).toHaveBeenCalledTimes(1);
    expect(workflowService.updateResearchProfileFromAgent).not.toHaveBeenCalled();
    expect(messagesService.createMessage).toHaveBeenCalledTimes(2);
    expect(result.assistantMessage.messageType).toBe(AssistantMessageType.RESEARCH_CHAT);
  });

  it("executes a real tool, returns its result to the LLM, and then saves the final reply", async () => {
    const toolCall = {
      id: "call-1",
      name: "update_research_profile",
      arguments: {
        profileUpdates: {
          dependentVariable: "ROA"
        }
      },
      rawArguments: JSON.stringify({
        profileUpdates: {
          dependentVariable: "ROA"
        }
      })
    };
    const { service, llmService, workflowService, harnessService } = createService({
      llmResponses: [
        {
          content: null,
          toolCalls: [toolCall],
          assistantMessage: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "call-1",
              type: "function",
              function: {
                name: "update_research_profile",
                arguments: toolCall.rawArguments
              }
            }]
          }
        },
        {
          content: "已将被解释变量更新为 ROA。",
          toolCalls: [],
          assistantMessage: {
            role: "assistant",
            content: "已将被解释变量更新为 ROA。"
          }
        }
      ]
    });

    const result = await service.handleTurn({
      projectId: "project-1",
      resumeToken: "token",
      userMessage: "把被解释变量改成 ROA"
    });

    expect(workflowService.updateResearchProfileFromAgent).toHaveBeenCalledTimes(1);
    expect(harnessService.recordToolResult).toHaveBeenCalledWith(
      expect.objectContaining({
        toolUseId: "call-1",
        toolName: "update_research_profile",
        status: "success"
      })
    );
    expect(llmService.generateAgentResponse).toHaveBeenCalledTimes(2);
    const secondCallMessages = llmService.generateAgentResponse.mock.calls[1][1];
    expect(secondCallMessages).toContainEqual(
      expect.objectContaining({
        role: "tool",
        tool_call_id: "call-1"
      })
    );
    expect(result.assistantMessage.contentText).toBe("已将被解释变量更新为 ROA。");
  });

  it("does not turn a research question into a profile update when the LLM is unavailable", async () => {
    const { service, workflowService } = createService({
      llmResponses: []
    });

    const result = await service.handleTurn({
      projectId: "project-1",
      resumeToken: "token",
      userMessage: "为什么经管论文里经常要加企业固定效应和年份固定效应？"
    });

    expect(workflowService.updateResearchProfileFromAgent).not.toHaveBeenCalled();
    expect(result.assistantMessage.contentText).toContain("AI 助手本轮调用失败");
  });
});
