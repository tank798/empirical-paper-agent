import { Body, Controller, Headers, Param, Post, Res } from "@nestjs/common";
import {
  WorkflowStep,
  workflowNextInputSchema,
  type WorkflowNextResponse,
  type WorkflowStreamEvent
} from "@empirical/shared";
import { ok } from "../../common/api-response";
import { HarnessService } from "../harness/harness.service";
import { ProjectsService } from "../projects/projects.service";
import { WorkflowService } from "./workflow.service";

@Controller("projects/:projectId/workflow")
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly projectsService: ProjectsService,
    private readonly harnessService: HarnessService
  ) {}

  @Post("next")
  async next(
    @Param("projectId") projectId: string,
    @Headers("x-project-token") token: string | undefined,
    @Body() body: unknown
  ) {
    const parsed = workflowNextInputSchema.parse(body ?? {});
    const project = await this.projectsService.assertProjectAccess(projectId, token);
    const run = await this.harnessService.createRun({
      projectId,
      kind: "workflow_next",
      requestedStep: parsed.requestedStep,
      currentStep: project.currentStep as WorkflowStep,
      userMessage: parsed.userMessage,
      inputJson: {
        requestedStep: parsed.requestedStep ?? null,
        payload: parsed.payload ?? {}
      }
    });

    try {
      const result = await this.workflowService.handleNext({
        projectId,
        resumeToken: token,
        userMessage: parsed.userMessage,
        requestedStep: parsed.requestedStep,
        payload: parsed.payload,
        agentRunId: run.id
      });
      await this.harnessService.completeRun(run.id, { currentStep: result.currentStep });
      return ok({ ...result, runId: run.id });
    } catch (error) {
      await this.harnessService.failRun(run.id, error);
      throw error;
    }
  }

  @Post("stream")
  async stream(
    @Param("projectId") projectId: string,
    @Headers("x-project-token") token: string | undefined,
    @Body() body: unknown,
    @Res() response: any
  ) {
    const parsed = workflowNextInputSchema.parse(body ?? {});
    const project = await this.projectsService.assertProjectAccess(projectId, token);
    const run = await this.harnessService.createRun({
      projectId,
      kind: "workflow_stream",
      requestedStep: parsed.requestedStep,
      currentStep: project.currentStep as WorkflowStep,
      userMessage: parsed.userMessage,
      inputJson: {
        requestedStep: parsed.requestedStep ?? null,
        payload: parsed.payload ?? {}
      }
    });
    let closed = false;
    let heartbeat: NodeJS.Timeout | null = null;

    const stopHeartbeat = () => {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    };

    const sendEvent = (event: WorkflowStreamEvent) => {
      if (closed) {
        return;
      }

      response.write(`data: ${JSON.stringify(event)}\n\n`);
      response.flush?.();
    };

    response.on?.("close", () => {
      closed = true;
      stopHeartbeat();
    });

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();

    try {
      sendEvent({
        type: "run",
        run
      });
      sendEvent({
        type: "status",
        runId: run.id,
        phase: "thinking",
        message: "Tank\u6b63\u5728\u601d\u8003\u4e2d..."
      });

      heartbeat = setInterval(() => {
        void this.harnessService.heartbeat(run.id, "stream heartbeat");
        sendEvent({
          type: "status",
          runId: run.id,
          phase: "thinking",
          message: "Tank\u6b63\u5728\u5904\u7406\u4e2d\uff0c\u8bf7\u7a0d\u7b49\u7247\u523b..."
        });
      }, 3000);

      const result = (await this.workflowService.handleNext({
        projectId,
        resumeToken: token,
        userMessage: parsed.userMessage,
        requestedStep: parsed.requestedStep,
        payload: parsed.payload,
        agentRunId: run.id,
        onProgress: async (progress) => {
          const updatedRun = await this.harnessService.updateRunProgress(run.id, progress);
          sendEvent({
            type: "progress",
            runId: run.id,
            progress: {
              ...progress,
              percent: updatedRun.progressPercent
            }
          });
        }
      })) as WorkflowNextResponse;

      stopHeartbeat();
      await this.harnessService.completeRun(run.id, { currentStep: result.currentStep });
      sendEvent({
        type: "status",
        runId: run.id,
        phase: "typing",
        message: "Tank\u6b63\u5728\u601d\u8003\u4e2d..."
      });
      sendEvent({ type: "message", runId: run.id, response: { ...result, runId: run.id } });
      sendEvent({ type: "done" });
    } catch (error) {
      stopHeartbeat();
      await this.harnessService.failRun(run.id, error);
      sendEvent({
        type: "error",
        runId: run.id,
        message: error instanceof Error ? error.message : "流式输出失败，请稍后重试。"
      });
      sendEvent({ type: "done" });
    } finally {
      stopHeartbeat();
      if (!closed) {
        response.end();
      }
    }
  }
}
