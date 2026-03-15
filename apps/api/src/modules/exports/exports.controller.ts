import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { ok } from "../../common/api-response";
import { ProjectsService } from "../projects/projects.service";

@Controller("projects/:projectId/exports")
export class ExportsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async createExport(
    @Param("projectId") projectId: string,
    @Headers("x-project-token") token?: string,
    @Body() body?: { type?: string }
  ) {
    await this.projectsService.assertProjectAccess(projectId, token);
    return ok({
      status: "coming_soon",
      type: body?.type ?? "docx",
      message: "导出能力已预留接口，后续阶段接入真实文件生成。"
    });
  }
}
