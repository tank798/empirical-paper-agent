import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { workflowNextInputSchema } from "@empirical/shared";
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
}
