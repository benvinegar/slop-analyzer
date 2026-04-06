import type { AnalysisResult, ReporterPlugin } from "../core/types";

export const jsonReporter: ReporterPlugin = {
  id: "json",
  render(result: AnalysisResult): string {
    return JSON.stringify(
      {
        rootDir: result.rootDir,
        config: result.config,
        summary: result.summary,
        files: result.files.map((file) => ({
          path: file.path,
          extension: file.extension,
          lineCount: file.lineCount,
          languageId: file.languageId,
        })),
        directories: result.directories,
        findings: result.findings,
        fileScores: result.fileScores,
        directoryScores: result.directoryScores,
      },
      null,
      2,
    );
  },
};
