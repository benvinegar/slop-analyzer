import type { RulePlugin } from "../../core/types";
import type { DirectoryMetrics } from "../../facts/types";

function averageFileCount(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export const directoryFanoutHotspotRule: RulePlugin = {
  id: "structure.directory-fanout-hotspot",
  family: "structure",
  severity: "medium",
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

    const siblingCounts = context.runtime.directories
      .map((directory) => context.runtime.store.getDirectoryFact<DirectoryMetrics>(directory.path, "directory.metrics")?.fileCount ?? 0)
      .filter((value) => value > 0);
    const baseline = averageFileCount(siblingCounts);
    const threshold = Math.max(6, Math.ceil(baseline * 1.75));

    if (metrics.fileCount < threshold) {
      return [];
    }

    return [
      {
        ruleId: "structure.directory-fanout-hotspot",
        family: "structure",
        severity: "medium",
        scope: "directory",
        path: context.directory!.path,
        message: `Directory fan-out is a repo hotspot (${metrics.fileCount} files vs baseline ${baseline.toFixed(1)})`,
        evidence: [
          `baseline=${baseline.toFixed(2)}`,
          `threshold=${threshold}`,
          `fileCount=${metrics.fileCount}`,
        ],
        score: 2 + Math.min(4, metrics.fileCount / Math.max(1, threshold)),
        locations: [{ path: context.directory!.path, line: 1 }],
      },
    ];
  },
};
