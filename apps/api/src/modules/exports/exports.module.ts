import { Module } from "@nestjs/common";
import { ProjectsModule } from "../projects/projects.module";
import { ExportsController } from "./exports.controller";

@Module({
  imports: [ProjectsModule],
  controllers: [ExportsController]
})
export class ExportsModule {}
