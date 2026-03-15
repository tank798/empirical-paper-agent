import { Controller, Get, Headers, Param } from "@nestjs/common";
import { ok } from "../../common/api-response";
import { ProjectsService } from "../projects/projects.service";
import { ExportStateService } from "./export-state.service";

@Controller("projects/:projectId/export-state")
export class ExportStateController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly exportStateService: ExportStateService
  ) {}

  @Get()
  async getState(
    @Param("projectId") projectId: string,
    @Headers("x-project-token") token?: string
  ) {
    await this.projectsService.assertProjectAccess(projectId, token);
    return ok(await this.exportStateService.getByProjectId(projectId));
  }
}
