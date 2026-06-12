import { Module } from "@nestjs/common";
import { ExportStateModule } from "../export-state/export-state.module";
import { MessagesModule } from "../messages/messages.module";
import { ProjectsModule } from "../projects/projects.module";
import { ResearchProfileModule } from "../research-profile/research-profile.module";
import { HarnessModule } from "../harness/harness.module";
import { SkillsController } from "./skills.controller";
import { SkillsService } from "./skills.service";

@Module({
  imports: [ProjectsModule, MessagesModule, ResearchProfileModule, ExportStateModule, HarnessModule],
  controllers: [SkillsController],
  providers: [SkillsService],
  exports: [SkillsService]
})
export class SkillsModule {}
