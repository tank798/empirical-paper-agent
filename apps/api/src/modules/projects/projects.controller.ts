import { BadRequestException, Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { createProjectInputSchema } from "@empirical/shared";
import { ok } from "../../common/api-response";
import { ProjectsService } from "./projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async createProject(@Body() body: unknown) {
    const parsed = createProjectInputSchema.safeParse({
      topicRaw: (body as { topicRaw?: string })?.topicRaw ?? ""
    });

    if (!parsed.success) {
      throw new BadRequestException("请输入研究主题或上传包含可识别文字的附件。");
    }

    return ok(await this.projectsService.createProject(parsed.data.topicRaw));
  }

  @Get(":id")
  async getProject(@Param("id") id: string, @Headers("x-project-token") token?: string) {
    return ok(await this.projectsService.getProjectDetail(id, token));
  }
}
