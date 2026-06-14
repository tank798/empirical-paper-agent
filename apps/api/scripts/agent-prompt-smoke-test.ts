import { readFile } from "fs/promises";
import { resolve } from "path";
import { ConfigService } from "@nestjs/config";
import { LlmService } from "../src/modules/llm/llm.service";
import { PromptService } from "../src/modules/prompt/prompt.service";
import { RESEARCH_AGENT_TOOLS } from "../src/modules/agent/research-agent.service";

async function main() {
  const envText = await readFile(resolve(process.cwd(), ".env"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && process.env[match[1]] == null) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  }

  const config = new ConfigService();
  const llm = new LlmService(config);
  const prompts = new PromptService(config);
  const basePrompt = await prompts.getResearchAgentPrompt();
  const setupPrompt = await readFile(resolve(process.cwd(), "../../测试集/测试prompt1.txt"), "utf8");
  const promptSuite = await readFile(resolve(process.cwd(), "../../测试集/测试prompt2.txt"), "utf8");
  const caseText = (caseNumber: number) => {
    const marker = String(caseNumber).padStart(2, "0");
    const match = promptSuite.match(new RegExp(`CASE ${marker}[^\\n]*\\n=+\\n([\\s\\S]*?)\\n\\n期望行为`));
    if (!match?.[1]) {
      throw new Error(`无法从测试prompt2提取CASE ${marker}`);
    }
    return match[1].trim();
  };
  const systemPrompt = [
    basePrompt,
    "",
    "# 当前运行上下文",
    "当前产品阶段：research_setup",
    "当前用户查看模块：TOPIC_NORMALIZE",
    "当前研究设定：{}"
  ].join("\n");

  const setupResponse = await llm.generateAgentResponse(
    systemPrompt,
    [{ role: "user", content: setupPrompt }],
    RESEARCH_AGENT_TOOLS,
    { profile: "reasoning", toolChoice: "auto", maxTokens: 1800 }
  );
  if (setupResponse.toolCalls[0]?.name !== "update_research_profile") {
    throw new Error(`测试prompt1应调用update_research_profile，实际为：${setupResponse.toolCalls[0]?.name ?? "direct_answer"}`);
  }
  const setupFollowUp = await llm.generateAgentResponse(
    systemPrompt,
    [
      { role: "user", content: setupPrompt },
      setupResponse.assistantMessage,
      {
        role: "tool",
        tool_call_id: setupResponse.toolCalls[0].id as string,
        content: JSON.stringify({
          ok: true,
          setupComplete: true,
          missingFields: [],
          changedFields: Object.keys(setupResponse.toolCalls[0].arguments.profileUpdates as Record<string, unknown>)
        })
      }
    ],
    RESEARCH_AGENT_TOOLS,
    { profile: "reasoning", toolChoice: "auto", maxTokens: 800 }
  );
  if (setupFollowUp.toolCalls.length > 0 || !setupFollowUp.content?.trim()) {
    throw new Error("工具执行结果返回后，Research Agent应生成最终回复，而不是重复调用工具。");
  }

  const questionResponse = await llm.generateAgentResponse(
    systemPrompt,
    [{ role: "user", content: caseText(12) }],
    RESEARCH_AGENT_TOOLS,
    { profile: "reasoning", toolChoice: "auto", maxTokens: 1000 }
  );
  if (questionResponse.toolCalls.length > 0 || !questionResponse.content?.trim()) {
    throw new Error("普通科研问题应直接回答，不应调用工具。");
  }

  const irrelevantResponse = await llm.generateAgentResponse(
    systemPrompt,
    [{ role: "user", content: caseText(14) }],
    RESEARCH_AGENT_TOOLS,
    { profile: "reasoning", toolChoice: "auto", maxTokens: 600 }
  );
  if (irrelevantResponse.toolCalls.length > 0 || !irrelevantResponse.content?.trim()) {
    throw new Error("无关问题应直接回复能力边界，不应调用工具。");
  }

  const incompleteSetupResponse = await llm.generateAgentResponse(
    systemPrompt,
    [{ role: "user", content: caseText(3) }],
    RESEARCH_AGENT_TOOLS,
    { profile: "reasoning", toolChoice: "auto", maxTokens: 1000 }
  );
  const incompleteUpdates = incompleteSetupResponse.toolCalls[0]?.arguments.profileUpdates as
    | Record<string, unknown>
    | undefined;
  if (
    incompleteSetupResponse.toolCalls[0]?.name !== "update_research_profile" ||
    incompleteUpdates?.researchObject != null ||
    incompleteUpdates?.sampleScope != null
  ) {
    throw new Error(
      `测试prompt2 CASE 03应只更新明确字段，不得编造研究对象或样本区间。实际：${JSON.stringify(incompleteUpdates)}`
    );
  }

  const topicChangeResponse = await llm.generateAgentResponse(
    systemPrompt,
    [{ role: "user", content: caseText(18) }],
    RESEARCH_AGENT_TOOLS,
    { profile: "reasoning", toolChoice: "auto", maxTokens: 1000 }
  );
  const topicChangeUpdates = topicChangeResponse.toolCalls[0]?.arguments.profileUpdates as
    | Record<string, unknown>
    | undefined;
  if (
    topicChangeResponse.toolCalls[0]?.name !== "update_research_profile" ||
    topicChangeUpdates?.independentVariable !== "数字化转型" ||
    topicChangeUpdates?.dependentVariable !== "绿色创新"
  ) {
    throw new Error("测试prompt2 CASE 18应同时更新主题、解释变量和被解释变量。");
  }

  console.log(JSON.stringify({
    setupPrompt: {
      action: setupResponse.toolCalls[0].name,
      profileUpdates: setupResponse.toolCalls[0].arguments.profileUpdates,
      clearFields: setupResponse.toolCalls[0].arguments.clearFields,
      finalReplyAfterToolResult: setupFollowUp.content
    },
    directQuestion: {
      toolCalls: questionResponse.toolCalls.length,
      answer: questionResponse.content
    },
    irrelevantQuestion: {
      toolCalls: irrelevantResponse.toolCalls.length,
      answer: irrelevantResponse.content
    },
    incompleteSetup: {
      action: incompleteSetupResponse.toolCalls[0].name,
      profileUpdates: incompleteUpdates
    },
    topicChange: {
      action: topicChangeResponse.toolCalls[0].name,
      profileUpdates: topicChangeUpdates
    }
  }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
