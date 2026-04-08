import type { RulePlugin } from "../../core/types";
import type { ExportSummary } from "../../facts/types";

/**
 * Flags files that are mostly re-export barrels.
 *
 * A small number of compatibility exports is common, so this rule only trips
 * when the file is effectively nothing but re-exports and has at least two of
 * them.
 */
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
      context.runtime.store.getFileFact<ExportSummary>(context.file!.path, "file.exportSummary") ??
      null;

    // `hasOnlyReExports` keeps the rule focused on pure barrel files instead of
    // legitimate modules that happen to re-export one or two helpers.
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
        // Cap the score because a barrel is a localized navigation smell, not a
        // catastrophic file-level failure.
        score: Math.min(3, 1 + summary.reExportCount * 0.5),
        locations: [{ path: context.file!.path, line: 1 }],
      },
    ];
  },
};
