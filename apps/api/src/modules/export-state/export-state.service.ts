import { Injectable } from "@nestjs/common";
import { ExportWriteMode, SkillName } from "@empirical/shared";
import { PrismaService } from "../prisma/prisma.service";
import { buildDefaultExportFileName } from "../../common/token";

const MODULE_EXPORT_FILE_NAMES: Partial<Record<string, string>> = {
  [SkillName.BASELINE_REGRESSION]: "baseline_results.doc",
  [SkillName.ROBUSTNESS]: "robustness_results.doc",
  [SkillName.IV]: "iv_results.doc",
  [SkillName.MECHANISM]: "mechanism_results.doc",
  [SkillName.HETEROGENEITY]: "heterogeneity_results.doc"
};

@Injectable()
export class ExportStateService {
  constructor(private readonly prisma: PrismaService) {}

  async getByProjectId(projectId: string) {
    const state = await this.prisma.projectExportState.findUnique({ where: { projectId } });
    if (!state) {
      return null;
    }

    return {
      projectId: state.projectId,
      defaultExportPath: state.defaultExportPath,
      defaultExportFileName: state.defaultExportFileName,
      hasWrittenRegressionTable: state.hasWrittenRegressionTable,
      nextWriteMode: state.nextWriteMode as "replace" | "append",
      updatedAt: state.updatedAt.toISOString()
    };
  }

  async ensure(projectId: string, title: string) {
    const existing = await this.prisma.projectExportState.findUnique({ where: { projectId } });
    if (existing) {
      return existing;
    }

    const fileName = buildDefaultExportFileName(title);
    return this.prisma.projectExportState.create({
      data: {
        projectId,
        defaultExportFileName: fileName,
        defaultExportPath: `D:\\results\\${fileName}`,
        hasWrittenRegressionTable: false,
        nextWriteMode: ExportWriteMode.REPLACE
      }
    });
  }

  async getNextRegressionExport(
    projectId: string,
    title: string,
    moduleName: string,
    overrides?: { fileName?: string; filePath?: string }
  ) {
    const state = await this.ensure(projectId, title);
    const fileName = overrides?.fileName || state.defaultExportFileName;
    const filePath = overrides?.filePath || state.defaultExportPath;
    const targetChanged =
      fileName !== state.defaultExportFileName || filePath !== state.defaultExportPath;

    const writeMode = targetChanged
      ? ExportWriteMode.REPLACE
      : (state.nextWriteMode as "replace" | "append");

    return {
      fileName,
      filePath,
      writeMode,
      exportCode: `outreg2 using \"${filePath}\", ${writeMode} tdec(2) bdec(3) adjr2 tstat addtext(Module, ${moduleName})`
    };
  }

  async markRegressionExportUsed(
    projectId: string,
    exportState: { fileName: string; filePath: string }
  ) {
    await this.prisma.projectExportState.update({
      where: { projectId },
      data: {
        defaultExportFileName: exportState.fileName,
        defaultExportPath: exportState.filePath,
        hasWrittenRegressionTable: true,
        nextWriteMode: ExportWriteMode.APPEND
      }
    });
  }
}
