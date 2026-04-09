import type { RulePlugin } from "../core/types";
import type { DuplicateFunctionIndex } from "../facts/types";
import { isTestFile } from "../facts/ts-helpers";

/**
 * Flags non-test files whose function bodies match the same normalized helper
 * shape found in several other source files.
 *
 * The intent is to catch "LLM rewrote a nearby helper instead of reusing it"
 * patterns without firing on tiny wrappers or one-off duplicates.
 */
export const duplicateFunctionSignaturesRule: RulePlugin = {
  id: "structure.duplicate-function-signatures",
  family: "structure",
  severity: "medium",
  scope: "file",
  requires: ["repo.duplicateFunctionSignatures"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file) && !isTestFile(context.file!.path);
  },
  evaluate(context) {
    const duplication = context.runtime.store.getRepoFact<DuplicateFunctionIndex>(
      "repo.duplicateFunctionSignatures",
    );
    const clusters = duplication?.byFile[context.file!.path] ?? [];

    if (clusters.length === 0) {
      return [];
    }

    const uniqueClusters = clusters.filter(
      (cluster, index) =>
        clusters.findIndex((candidate) => candidate.fingerprint === cluster.fingerprint) === index,
    );

    return [
      {
        ruleId: "structure.duplicate-function-signatures",
        family: "structure",
        severity: "medium",
        scope: "file",
        path: context.file!.path,
        message: `Found ${uniqueClusters.length} duplicated function signature${uniqueClusters.length === 1 ? "" : "s"}`,
        evidence: uniqueClusters.map((cluster) => {
          const peers = [
            ...new Set(
              cluster.occurrences.map((occurrence) => `${occurrence.path}#${occurrence.name}`),
            ),
          ]
            .filter((entry) => !entry.startsWith(`${context.file!.path}#`))
            .slice(0, 3)
            .join(", ");
          return `${cluster.label} repeated in ${cluster.fileCount} files${peers ? ` (also: ${peers})` : ""}`;
        }),
        score: Math.min(
          6,
          uniqueClusters.reduce(
            (total, cluster) => total + 1.25 + (cluster.fileCount - 3) * 0.5,
            0,
          ),
        ),
        locations: uniqueClusters.flatMap((cluster) =>
          cluster.occurrences.map((occurrence) => ({
            path: occurrence.path,
            line: occurrence.line,
          })),
        ),
      },
    ];
  },
};
