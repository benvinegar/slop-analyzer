import type { AnalysisResult, ReporterPlugin } from "../core/types";

export const textReporter: ReporterPlugin = {
  id: "text",
  render(result: AnalysisResult): string {
    const lines = [
      "repo-slop-analyzer report",
      `root: ${result.rootDir}`,
      `files scanned: ${result.files.length}`,
      `directories scanned: ${result.directories.length}`,
      `findings: ${result.findings.length}`,
      `repo score: ${result.repoScore.toFixed(2)}`,
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
