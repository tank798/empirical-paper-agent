import { Module } from "@nestjs/common";
import { MessagesModule } from "../messages/messages.module";
import { ProjectsModule } from "../projects/projects.module";
import { ResearchProfileModule } from "../research-profile/research-profile.module";
import { SkillsModule } from "../skills/skills.module";
import { HarnessModule } from "../harness/harness.module";
import { ResearchAgentService } from "../agent/research-agent.service";
import { WorkflowController } from "./workflow.controller";
import { WorkflowService } from "./workflow.service";

@Module({
  imports: [ProjectsModule, MessagesModule, ResearchProfileModule, SkillsModule, HarnessModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, ResearchAgentService],
  exports: [WorkflowService]
})
export class WorkflowModule {}
