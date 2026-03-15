import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { ResearchProfileController } from "./research-profile.controller";
import { ResearchProfileService } from "./research-profile.service";

@Module({
  imports: [ProjectsModule],
  controllers: [ResearchProfileController],
  providers: [ResearchProfileService],
  exports: [ResearchProfileService]
})
export class ResearchProfileModule {}
