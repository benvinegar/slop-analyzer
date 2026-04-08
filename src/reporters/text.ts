import type { AnalysisResult, ReporterPlugin } from "../core/types";

function formatMetric(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(2);
}

export const textReporter: ReporterPlugin = {
  id: "text",
  render(result: AnalysisResult): string {
    const { summary } = result;
    const lines = [
      "slop-analyzer report",
      `root: ${result.rootDir}`,
      `files scanned: ${summary.fileCount}`,
      `directories scanned: ${summary.directoryCount}`,
      `physical LOC: ${summary.physicalLineCount}`,
      `logical LOC: ${summary.logicalLineCount}`,
      `functions: ${summary.functionCount}`,
      "",
      "Primary normalized metrics:",
      `- score / file: ${formatMetric(summary.normalized.scorePerFile)}`,
      `- score / KLOC (logical): ${formatMetric(summary.normalized.scorePerKloc)}`,
      `- score / function: ${formatMetric(summary.normalized.scorePerFunction)}`,
      `- findings / file: ${formatMetric(summary.normalized.findingsPerFile)}`,
      `- findings / KLOC (logical): ${formatMetric(summary.normalized.findingsPerKloc)}`,
      `- findings / function: ${formatMetric(summary.normalized.findingsPerFunction)}`,
      "",
      "Raw totals:",
      `- findings: ${summary.findingCount}`,
      `- repo score: ${summary.repoScore.toFixed(2)}`,
    ];

    if (result.fileScores.length > 0) {
      lines.push("", "File hotspots:");
      for (const hotspot of result.fileScores.slice(0, 5)) {
        lines.push(`- ${hotspot.path}: score=${hotspot.score.toFixed(2)} findings=${hotspot.findingCount}`);
      }
    }

    if (result.directoryScores.length > 0) {
      lines.push("", "Directory hotspots:");
      for (const hotspot of result.directoryScores.slice(0, 5)) {
        lines.push(`- ${hotspot.path}: score=${hotspot.score.toFixed(2)} findings=${hotspot.findingCount}`);
      }
    }

    return lines.join("\n");
  },
};
