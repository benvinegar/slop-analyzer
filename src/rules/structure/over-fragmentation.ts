import type { RulePlugin } from "../../core/types";
import type { DirectoryMetrics } from "../../facts/types";

export const overFragmentationRule: RulePlugin = {
  id: "structure.over-fragmentation",
  family: "structure",
  severity: "strong",
  scope: "directory",
  requires: ["directory.metrics"],
  supports(context) {
    return context.scope === "directory" && Boolean(context.directory);
  },
  evaluate(context) {
    const metrics =
      context.runtime.store.getDirectoryFact<DirectoryMetrics>(context.directory!.path, "directory.metrics") ?? null;

    if (!metrics) {
      return [];
    }

    const tinyRatio = metrics.fileCount === 0 ? 0 : metrics.tinyFileCount / metrics.fileCount;
    const ceremonyRatio = metrics.fileCount === 0 ? 0 : (metrics.wrapperFileCount + metrics.barrelFileCount) / metrics.fileCount;

    if (metrics.fileCount < 6 || tinyRatio < 0.6) {
      return [];
    }

    return [
      {
        ruleId: "structure.over-fragmentation",
        family: "structure",
        severity: "strong",
        scope: "directory",
        path: context.directory!.path,
        message: `Directory looks over-fragmented (${metrics.fileCount} files, ${metrics.tinyFileCount} tiny files)`,
        evidence: [
          `tinyRatio=${tinyRatio.toFixed(2)}`,
          `ceremonyRatio=${ceremonyRatio.toFixed(2)}`,
          `wrapperFiles=${metrics.wrapperFileCount}`,
          `barrelFiles=${metrics.barrelFileCount}`,
        ],
        score: 4 + tinyRatio * 3 + ceremonyRatio * 2,
        locations: [{ path: context.directory!.path, line: 1 }],
      },
    ];
  },
};
