import type { RulePlugin } from "../../core/types";
import type { FunctionSummary } from "../../facts/types";

export const passThroughWrappersRule: RulePlugin = {
  id: "structure.pass-through-wrappers",
  family: "structure",
  severity: "strong",
  scope: "file",
  requires: ["file.functionSummaries"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  evaluate(context) {
    const functions =
      context.runtime.store.getFileFact<FunctionSummary[]>(context.file!.path, "file.functionSummaries") ?? [];
    const wrappers = functions.filter((summary) => summary.isPassThroughWrapper);

    if (wrappers.length === 0) {
      return [];
    }

    return [
      {
        ruleId: "structure.pass-through-wrappers",
        family: "structure",
        severity: "strong",
        scope: "file",
        path: context.file!.path,
        message: `Found ${wrappers.length} pass-through wrapper${wrappers.length === 1 ? "" : "s"}`,
        evidence: wrappers.map((summary) => `${summary.name} at line ${summary.line}`),
        score: Math.min(6, wrappers.length * 2.5),
        locations: wrappers.map((summary) => ({ path: context.file!.path, line: summary.line })),
      },
    ];
  },
};
