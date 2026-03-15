import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { ExportStateController } from "./export-state.controller";
import { ExportStateService } from "./export-state.service";

@Module({
  imports: [ProjectsModule],
  controllers: [ExportStateController],
  providers: [ExportStateService],
  exports: [ExportStateService]
})
export class ExportStateModule {}
