import type { FactProvider } from "../core/types";
import type { DuplicateFunctionCluster, DuplicateFunctionIndex, FunctionSummary } from "./types";
import { isTestFile } from "./ts-helpers";

const MIN_CLUSTER_FILE_COUNT = 3;

function buildLabel(summary: FunctionSummary): string {
  return `${summary.parameterCount} param${summary.parameterCount === 1 ? "" : "s"}, ${summary.statementCount} statement${summary.statementCount === 1 ? "" : "s"}${summary.isAsync ? ", async" : ""}`;
}

export const functionDuplicationFactProvider: FactProvider = {
  id: "fact.repo.function-duplication",
  scope: "repo",
  requires: ["repo.files", "file.functionSummaries"],
  provides: ["repo.duplicateFunctionSignatures"],
  supports(context) {
    return context.scope === "repo";
  },
  run(context) {
    const fingerprints = new Map<string, DuplicateFunctionCluster>();

    for (const file of context.runtime.files) {
      if (isTestFile(file.path)) {
        continue;
      }

      const functions =
        context.runtime.store.getFileFact<FunctionSummary[]>(file.path, "file.functionSummaries") ??
        [];
      for (const summary of functions) {
        if (!summary.duplicationFingerprint) {
          continue;
        }

        let cluster = fingerprints.get(summary.duplicationFingerprint);
        if (!cluster) {
          cluster = {
            fingerprint: summary.duplicationFingerprint,
            label: buildLabel(summary),
            fileCount: 0,
            occurrences: [],
          };
          fingerprints.set(summary.duplicationFingerprint, cluster);
        }

        cluster.occurrences.push({ path: file.path, line: summary.line, name: summary.name });
      }
    }

    const clusters = [...fingerprints.values()]
      .map((cluster) => ({
        ...cluster,
        fileCount: new Set(cluster.occurrences.map((occurrence) => occurrence.path)).size,
      }))
      .filter((cluster) => cluster.fileCount >= MIN_CLUSTER_FILE_COUNT)
      .sort(
        (left, right) => right.fileCount - left.fileCount || left.label.localeCompare(right.label),
      );

    const byFile: Record<string, DuplicateFunctionCluster[]> = {};
    for (const cluster of clusters) {
      for (const occurrence of cluster.occurrences) {
        byFile[occurrence.path] ??= [];
        byFile[occurrence.path].push(cluster);
      }
    }

    const result: DuplicateFunctionIndex = { byFile, clusters };
    return { "repo.duplicateFunctionSignatures": result };
  },
};
