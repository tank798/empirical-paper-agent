import { Controller, Get, Headers, Param } from "@nestjs/common";
import { ok } from "../../common/api-response";
import { ProjectsService } from "../projects/projects.service";
import { HarnessService } from "./harness.service";

@Controller("projects/:projectId/harness")
export class HarnessController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly harnessService: HarnessService
  ) {}

  @Get("runs/active")
  async activeRun(
    @Param("projectId") projectId: string,
    @Headers("x-project-token") token?: string
  ) {
    await this.projectsService.assertProjectAccess(projectId, token);
    return ok(await this.harnessService.getLatestActiveRun(projectId));
  }

  @Get("runs/:runId")
  async run(
    @Param("projectId") projectId: string,
    @Param("runId") runId: string,
    @Headers("x-project-token") token?: string
  ) {
    await this.projectsService.assertProjectAccess(projectId, token);
    return ok(await this.harnessService.getRun(projectId, runId));
  }
}
