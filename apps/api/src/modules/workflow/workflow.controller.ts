import { Body, Controller, Headers, Param, Post, Res } from "@nestjs/common";
import {
  workflowNextInputSchema,
  type WorkflowNextResponse,
  type WorkflowStreamEvent
} from "@empirical/shared";
import { ok } from "../../common/api-response";
import { WorkflowService } from "./workflow.service";

@Controller("projects/:projectId/workflow")
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post("next")
  async next(
    @Param("projectId") projectId: string,
    @Headers("x-project-token") token: string | undefined,
    @Body() body: unknown
  ) {
    const parsed = workflowNextInputSchema.parse(body ?? {});
    return ok(
      await this.workflowService.handleNext({
        projectId,
        resumeToken: token,
        userMessage: parsed.userMessage,
        requestedStep: parsed.requestedStep,
        payload: parsed.payload
      })
    );
  }

  @Post("stream")
  async stream(
    @Param("projectId") projectId: string,
    @Headers("x-project-token") token: string | undefined,
    @Body() body: unknown,
    @Res() response: any
  ) {
    const parsed = workflowNextInputSchema.parse(body ?? {});
    const sendEvent = (event: WorkflowStreamEvent) => {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    response.status(200);
    response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache, no-transform");
    response.setHeader("Connection", "keep-alive");
    response.setHeader("X-Accel-Buffering", "no");
    response.flushHeaders?.();

    try {
      sendEvent({
        type: "status",
        phase: "thinking",
        message: "Tank 正在思考中..."
      });

      const result = (await this.workflowService.handleNext({
        projectId,
        resumeToken: token,
        userMessage: parsed.userMessage,
        requestedStep: parsed.requestedStep,
        payload: parsed.payload
      })) as WorkflowNextResponse;

      sendEvent({
        type: "status",
        phase: "typing",
        message: "Tank 正在生成这一轮内容..."
      });
      sendEvent({ type: "message", response: result });
      sendEvent({ type: "done" });
    } catch (error) {
      sendEvent({
        type: "error",
        message: error instanceof Error ? error.message : "流式输出失败，请稍后重试。"
      });
      sendEvent({ type: "done" });
    } finally {
      response.end();
    }
  }
}