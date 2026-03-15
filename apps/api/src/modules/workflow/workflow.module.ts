import { Module } from "@nestjs/common";
import { MessagesModule } from "../messages/messages.module";
import { ProjectsModule } from "../projects/projects.module";
import { ResearchProfileModule } from "../research-profile/research-profile.module";
import { SkillsModule } from "../skills/skills.module";
import { WorkflowController } from "./workflow.controller";
import { WorkflowService } from "./workflow.service";

@Module({
  imports: [ProjectsModule, MessagesModule, ResearchProfileModule, SkillsModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService]
})
export class WorkflowModule {}
