import { Body, Controller, Headers, Param, Post } from "@nestjs/common";
import { skillNameSchema } from "@empirical/shared";
import { ok } from "../../common/api-response";
import { ProjectsService } from "../projects/projects.service";
import { SkillsService } from "./skills.service";

@Controller("projects/:projectId/skills")
export class SkillsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly skillsService: SkillsService
  ) {}

  @Post(":skillName")
  async executeSkill(
    @Param("projectId") projectId: string,
    @Param("skillName") skillName: string,
    @Headers("x-project-token") token: string | undefined,
    @Body() body?: { payload?: Record<string, unknown>; step?: string }
  ) {
    await this.projectsService.assertProjectAccess(projectId, token);
    const parsedSkill = skillNameSchema.parse(skillName);
    const detail = await this.projectsService.getProjectDetail(projectId, token);

    return ok(
      await this.skillsService.executeSkill({
        projectId,
        skillName: parsedSkill,
        step: (body?.step as any) ?? detail.project.currentStep,
        payload: body?.payload ?? {}
      })
    );
  }
}
