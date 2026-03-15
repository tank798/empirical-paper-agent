import { Controller, Get, Headers, Param } from "@nestjs/common";
import { ok } from "../../common/api-response";
import { ProjectsService } from "../projects/projects.service";
import { MessagesService } from "./messages.service";

@Controller("projects/:projectId/messages")
export class MessagesController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly messagesService: MessagesService
  ) {}

  @Get()
  async getMessages(
    @Param("projectId") projectId: string,
    @Headers("x-project-token") token?: string
  ) {
    await this.projectsService.assertProjectAccess(projectId, token);
    return ok(await this.messagesService.getProjectMessages(projectId));
  }
}
