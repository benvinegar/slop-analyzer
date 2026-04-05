import * as ts from "typescript";
import type { FactProvider } from "../core/types";
import type { ExportSummary } from "./types";

export const exportsFactProvider: FactProvider = {
  id: "fact.file.exports",
  scope: "file",
  requires: ["file.ast"],
  provides: ["file.exportSummary"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  run(context) {
    const sourceFile = context.runtime.store.getFileFact<ts.SourceFile>(context.file!.path, "file.ast");
    if (!sourceFile) {
      return {
        "file.exportSummary": {
          topLevelStatementCount: 0,
          reExportCount: 0,
          hasOnlyReExports: false,
        } satisfies ExportSummary,
      };
    }

    const statements = sourceFile.statements;
    const reExportCount = statements.filter(
      (statement) =>
        ts.isExportDeclaration(statement) &&
        Boolean(statement.moduleSpecifier) &&
        (!statement.exportClause || ts.isNamedExports(statement.exportClause) || statement.isTypeOnly),
    ).length;

    const summary: ExportSummary = {
      topLevelStatementCount: statements.length,
      reExportCount,
      hasOnlyReExports: statements.length > 0 && reExportCount === statements.length,
    };

    return { "file.exportSummary": summary };
  },
};
