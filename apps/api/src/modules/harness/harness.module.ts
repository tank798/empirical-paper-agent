import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { HarnessController } from "./harness.controller";
import { HarnessService } from "./harness.service";

@Module({
  imports: [ProjectsModule],
  controllers: [HarnessController],
  providers: [HarnessService],
  exports: [HarnessService]
})
export class HarnessModule {}
