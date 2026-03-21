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
        type: "status",
        phase: "thinking",
        message: "Tank\u6b63\u5728\u601d\u8003\u4e2d..."
      });

      heartbeat = setInterval(() => {
        sendEvent({
          type: "status",
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
        onProgress: async (progress) => {
          sendEvent({
            type: "progress",
            progress
          });
        }
      })) as WorkflowNextResponse;

      stopHeartbeat();
      sendEvent({
        type: "status",
        phase: "typing",
        message: "Tank\u6b63\u5728\u601d\u8003\u4e2d..."
      });
      sendEvent({ type: "message", response: result });
      sendEvent({ type: "done" });
    } catch (error) {
      stopHeartbeat();
      sendEvent({
        type: "error",
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
