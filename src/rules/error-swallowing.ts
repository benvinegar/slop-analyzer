import type { RulePlugin } from "../core/types";
import type { TryCatchSummary } from "../facts/types";
import {
  formatTryCatchBoundary,
  isValidTryCatchTarget,
  scoreTryCatch,
} from "./try-catch-rule-helpers";

/**
 * Flags catch blocks that only log and then continue without changing control
 * flow. This is the clearest "we noticed the error but effectively ignored it"
 * pattern in generated defensive code.
 */
export const errorSwallowingRule: RulePlugin = {
  id: "defensive.error-swallowing",
  family: "defensive",
  severity: "strong",
  scope: "file",
  requires: ["file.tryCatchSummaries"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  evaluate(context) {
    const summaries =
      context.runtime.store.getFileFact<TryCatchSummary[]>(
        context.file!.path,
        "file.tryCatchSummaries",
      ) ?? [];

    const flagged = summaries.filter(
      (summary) =>
        isValidTryCatchTarget(summary) && summary.tryStatementCount <= 2 && summary.catchLogsOnly,
    );

    if (flagged.length === 0) {
      return [];
    }

    return [
      {
        ruleId: "defensive.error-swallowing",
        family: "defensive",
        severity: "strong",
        scope: "file",
        path: context.file!.path,
        message: `Found ${flagged.length} log-and-continue catch block${flagged.length === 1 ? "" : "s"}`,
        evidence: flagged.map(
          (summary) =>
            `line ${summary.line}: catch logs only, boundary=${formatTryCatchBoundary(summary)}`,
        ),
        score: Math.min(
          8,
          flagged.reduce((total, summary) => total + scoreTryCatch(summary), 0),
        ),
        locations: flagged.map((summary) => ({ path: context.file!.path, line: summary.line })),
      },
    ];
  },
};
