import type { RulePlugin } from "../../core/types";
import type { TryCatchSummary } from "../../facts/types";

export const needlessTryCatchRule: RulePlugin = {
  id: "defensive.needless-try-catch",
  family: "defensive",
  severity: "strong",
  scope: "file",
  requires: ["file.tryCatchSummaries"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  evaluate(context) {
    const summaries =
      context.runtime.store.getFileFact<TryCatchSummary[]>(context.file!.path, "file.tryCatchSummaries") ?? [];

    const flagged = summaries.filter(
      (summary) =>
        summary.tryStatementCount <= 2 &&
        (
          summary.catchLogsOnly ||
          summary.catchReturnsDefault ||
          summary.catchIsEmpty ||
          summary.catchThrowsGeneric ||
          (summary.catchHasLogging && summary.catchHasDefaultReturn)
        ),
    );

    if (flagged.length === 0) {
      return [];
    }

    return [
      {
        ruleId: "defensive.needless-try-catch",
        family: "defensive",
        severity: "strong",
        scope: "file",
        path: context.file!.path,
        message: `Found ${flagged.length} defensive try/catch block${flagged.length === 1 ? "" : "s"}`,
        evidence: flagged.map(
          (summary) =>
            `line ${summary.line}: try=${summary.tryStatementCount}, catch=${summary.catchStatementCount}, logsOnly=${summary.catchLogsOnly}, returnsDefault=${summary.catchReturnsDefault}`,
        ),
        score: Math.min(8, flagged.length * 3),
        locations: flagged.map((summary) => ({ path: context.file!.path, line: summary.line })),
      },
    ];
  },
};
