import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { MessagesModule } from "./modules/messages/messages.module";
import { ResearchProfileModule } from "./modules/research-profile/research-profile.module";
import { ExportStateModule } from "./modules/export-state/export-state.module";
import { PromptModule } from "./modules/prompt/prompt.module";
import { LlmModule } from "./modules/llm/llm.module";
import { SkillsModule } from "./modules/skills/skills.module";
import { WorkflowModule } from "./modules/workflow/workflow.module";
import { ExportsModule } from "./modules/exports/exports.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", ".env.local"] }),
    PrismaModule,
    ProjectsModule,
    MessagesModule,
    ResearchProfileModule,
    ExportStateModule,
    PromptModule,
    LlmModule,
    SkillsModule,
    WorkflowModule,
    ExportsModule
  ]
})
export class AppModule {}
