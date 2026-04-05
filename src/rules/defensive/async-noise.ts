import type { RulePlugin } from "../../core/types";
import type { FunctionSummary } from "../../facts/types";

export const asyncNoiseRule: RulePlugin = {
  id: "defensive.async-noise",
  family: "defensive",
  severity: "medium",
  scope: "file",
  requires: ["file.functionSummaries"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  evaluate(context) {
    const functions =
      context.runtime.store.getFileFact<FunctionSummary[]>(context.file!.path, "file.functionSummaries") ?? [];

    const noisy = functions.filter(
      (summary) => (summary.isAsync && !summary.hasAwait) || summary.hasReturnAwaitCall,
    );

    if (noisy.length === 0) {
      return [];
    }

    return [
      {
        ruleId: "defensive.async-noise",
        family: "defensive",
        severity: "medium",
        scope: "file",
        path: context.file!.path,
        message: `Found ${noisy.length} async-noise pattern${noisy.length === 1 ? "" : "s"}`,
        evidence: noisy.map((summary) => `${summary.name} at line ${summary.line}`),
        score: Math.min(4, noisy.length * 1.5),
        locations: noisy.map((summary) => ({ path: context.file!.path, line: summary.line })),
      },
    ];
  },
};
