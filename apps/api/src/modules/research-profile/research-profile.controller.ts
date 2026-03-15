import { Body, Controller, Headers, Param, Put } from "@nestjs/common";
import { researchProfileSchema } from "@empirical/shared";
import { ok } from "../../common/api-response";
import { ProjectsService } from "../projects/projects.service";
import { ResearchProfileService } from "./research-profile.service";

@Controller("projects/:projectId/research-profile")
export class ResearchProfileController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly researchProfileService: ResearchProfileService
  ) {}

  @Put()
  async updateProfile(
    @Param("projectId") projectId: string,
    @Headers("x-project-token") token: string | undefined,
    @Body() body: unknown
  ) {
    await this.projectsService.assertProjectAccess(projectId, token);
    const parsed = researchProfileSchema.partial().parse(body ?? {});
    return ok(await this.researchProfileService.mergeExplicitUpdates(projectId, parsed));
  }
}
