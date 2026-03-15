import { Body, Controller, Get, Headers, Param, Post } from "@nestjs/common";
import { createProjectInputSchema } from "@empirical/shared";
import { ok } from "../../common/api-response";
import { ProjectsService } from "./projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async createProject(@Body() body: unknown) {
    const parsed = createProjectInputSchema.parse({
      topicRaw: (body as { topicRaw?: string })?.topicRaw ?? ""
    });

    return ok(await this.projectsService.createProject(parsed.topicRaw));
  }

  @Get(":id")
  async getProject(@Param("id") id: string, @Headers("x-project-token") token?: string) {
    return ok(await this.projectsService.getProjectDetail(id, token));
  }
}
