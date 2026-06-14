import { readFile } from "fs/promises";
import { resolve } from "path";
import { NestFactory } from "@nestjs/core";
import { WorkflowStep } from "@empirical/shared";
import { AppModule } from "../src/app.module";
import { ResearchAgentService } from "../src/modules/agent/research-agent.service";
import { PrismaService } from "../src/modules/prisma/prisma.service";
import { ProjectsService } from "../src/modules/projects/projects.service";
import { ResearchProfileService } from "../src/modules/research-profile/research-profile.service";

const WORKFLOW_SKILLS = [
  "sop_guide",
  "data_cleaning",
  "data_check",
  "baseline_regression",
  "robustness",
  "iv",
  "mechanism",
  "heterogeneity"
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
  const projects = app.get(ProjectsService);
  const profiles = app.get(ResearchProfileService);
  const agent = app.get(ResearchAgentService);
  const prisma = app.get(PrismaService);

  try {
    const fullPrompt = await readFile(resolve(process.cwd(), "../../测试集/测试prompt1.txt"), "utf8");
    const setupProject = await projects.createProject("Agent smoke test setup");
    const setupResult = await agent.handleTurn({
      projectId: setupProject.project.id,
      resumeToken: setupProject.resumeToken,
      userMessage: fullPrompt,
      requestedStep: WorkflowStep.TOPIC_NORMALIZE
    });
    const profile = await profiles.getByProjectId(setupProject.project.id);

    if (!profile?.independentVariable || !profile?.dependentVariable || profile.controls.length < 5) {
      throw new Error("测试prompt1未能形成完整研究设定。");
    }

    const generationResult = await agent.handleTurn({
      projectId: setupProject.project.id,
      resumeToken: setupProject.resumeToken,
      userMessage: "确认并生成",
      requestedStep: WorkflowStep.TOPIC_NORMALIZE
    });
    const workflowRuns = await prisma.skillRun.findMany({
      where: {
        projectId: setupProject.project.id,
        skillName: { in: WORKFLOW_SKILLS }
      },
      select: {
        skillName: true,
        status: true
      }
    });
    const generatedSkills = new Set(workflowRuns.map((run) => run.skillName));
    const nonDeterministicRuns = workflowRuns.filter((run) => run.status !== "deterministic");

    if (generatedSkills.size !== WORKFLOW_SKILLS.length) {
      throw new Error(`工作流模块生成不完整：${Array.from(generatedSkills).join(", ")}`);
    }
    if (nonDeterministicRuns.length > 0) {
      throw new Error(`发现未走确定性执行的工作流模块：${nonDeterministicRuns.map((run) => run.skillName).join(", ")}`);
    }

    const questionProject = await projects.createProject("Agent smoke test question");
    const questionResult = await agent.handleTurn({
      projectId: questionProject.project.id,
      resumeToken: questionProject.resumeToken,
      userMessage: "固定效应是什么？",
      requestedStep: WorkflowStep.TOPIC_NORMALIZE
    });
    const questionProfile = await profiles.getByProjectId(questionProject.project.id);
    if (questionProfile) {
      throw new Error("普通科研问题不应创建或修改研究设定。");
    }
    if (!questionResult.assistantMessage.contentText?.trim()) {
      throw new Error("普通科研问题没有得到回答。");
    }

    const fallbackEvents = await prisma.agentEvent.count({
      where: {
        projectId: { in: [setupProject.project.id, questionProject.project.id] },
        type: "agent_fallback"
      }
    });

    console.log(JSON.stringify({
      setup: {
        currentStep: setupResult.currentStep,
        independentVariable: profile.independentVariable,
        dependentVariable: profile.dependentVariable,
        controls: profile.controls.length,
        mechanisms: profile.mechanismVariables,
        setupReply: setupResult.assistantMessage.contentText
      },
      generation: {
        currentStep: generationResult.currentStep,
        deterministicWorkflowRuns: workflowRuns.length,
        modules: Array.from(generatedSkills),
        reply: generationResult.assistantMessage.contentText
      },
      directQuestion: {
        profileCreated: Boolean(questionProfile),
        reply: questionResult.assistantMessage.contentText
      },
      agentFallbackEvents: fallbackEvents
    }, null, 2));
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
