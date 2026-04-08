import type { FactProvider } from "../core/types";
import type { DirectoryMetrics, ExportSummary, FunctionSummary } from "./types";

const TINY_FILE_LINE_THRESHOLD = 25;

export const directoryMetricsFactProvider: FactProvider = {
  id: "fact.directory.metrics",
  scope: "directory",
  requires: ["directory.record", "file.lineCount", "file.functionSummaries", "file.exportSummary"],
  provides: ["directory.metrics"],
  supports(context) {
    return context.scope === "directory" && Boolean(context.directory);
  },
  run(context) {
    const directory = context.directory!;
    const metrics: DirectoryMetrics = {
      fileCount: directory.filePaths.length,
      tinyFileCount: 0,
      wrapperFileCount: 0,
      barrelFileCount: 0,
      totalLineCount: 0,
    };

    for (const filePath of directory.filePaths) {
      const lineCount = context.runtime.store.getFileFact<number>(filePath, "file.lineCount") ?? 0;
      const functions =
        context.runtime.store.getFileFact<FunctionSummary[]>(filePath, "file.functionSummaries") ??
        [];
      const exportSummary =
        context.runtime.store.getFileFact<ExportSummary>(filePath, "file.exportSummary") ?? null;

      metrics.totalLineCount += lineCount;
      if (lineCount <= TINY_FILE_LINE_THRESHOLD) {
        metrics.tinyFileCount += 1;
      }

      if (functions.some((summary) => summary.isPassThroughWrapper)) {
        metrics.wrapperFileCount += 1;
      }

      if (exportSummary?.hasOnlyReExports && exportSummary.reExportCount >= 2) {
        metrics.barrelFileCount += 1;
      }
    }

    return { "directory.metrics": metrics };
  },
};
