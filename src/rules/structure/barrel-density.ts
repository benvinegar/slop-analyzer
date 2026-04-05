import type { RulePlugin } from "../../core/types";
import type { ExportSummary } from "../../facts/types";

export const barrelDensityRule: RulePlugin = {
  id: "structure.barrel-density",
  family: "structure",
  severity: "medium",
  scope: "file",
  requires: ["file.exportSummary"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  evaluate(context) {
    const summary =
      context.runtime.store.getFileFact<ExportSummary>(context.file!.path, "file.exportSummary") ?? null;

    if (!summary || !summary.hasOnlyReExports || summary.reExportCount < 2) {
      return [];
    }

    return [
      {
        ruleId: "structure.barrel-density",
        family: "structure",
        severity: "medium",
        scope: "file",
        path: context.file!.path,
        message: `File is primarily a barrel with ${summary.reExportCount} re-export statements`,
        evidence: [`topLevelStatementCount=${summary.topLevelStatementCount}`],
        score: Math.min(3, 1 + summary.reExportCount * 0.5),
        locations: [{ path: context.file!.path, line: 1 }],
      },
    ];
  },
};
