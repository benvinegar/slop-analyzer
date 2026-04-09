import * as ts from "typescript";
import type { FactProvider } from "../core/types";
import type { ExportSummary } from "./types";

const MAX_EXPORT_SUMMARY_CACHE_ENTRIES = 500;
const exportSummaryCache = new Map<string, { text: string; summary: ExportSummary }>();

/** Stores export summaries for unchanged file text. */
function cacheExportSummary(filePath: string, text: string, summary: ExportSummary): void {
  if (
    !exportSummaryCache.has(filePath) &&
    exportSummaryCache.size >= MAX_EXPORT_SUMMARY_CACHE_ENTRIES
  ) {
    const oldestKey = exportSummaryCache.keys().next().value;
    if (oldestKey) {
      exportSummaryCache.delete(oldestKey);
    }
  }

  exportSummaryCache.set(filePath, { text, summary });
}

export const exportsFactProvider: FactProvider = {
  id: "fact.file.exports",
  scope: "file",
  requires: ["file.ast"],
  provides: ["file.exportSummary"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  run(context) {
    const file = context.file;
    const sourceFile = context.runtime.store.getFileFact<ts.SourceFile>(
      context.file!.path,
      "file.ast",
    );
    if (!file || !sourceFile) {
      return {
        "file.exportSummary": {
          topLevelStatementCount: 0,
          reExportCount: 0,
          hasOnlyReExports: false,
        } satisfies ExportSummary,
      };
    }

    const cached = exportSummaryCache.get(file.absolutePath);
    if (cached && cached.text === sourceFile.text) {
      return { "file.exportSummary": cached.summary };
    }

    const statements = sourceFile.statements;
    const reExportCount = statements.filter(
      (statement) =>
        ts.isExportDeclaration(statement) &&
        Boolean(statement.moduleSpecifier) &&
        (!statement.exportClause ||
          ts.isNamedExports(statement.exportClause) ||
          statement.isTypeOnly),
    ).length;

    const summary: ExportSummary = {
      topLevelStatementCount: statements.length,
      reExportCount,
      hasOnlyReExports: statements.length > 0 && reExportCount === statements.length,
    };

    cacheExportSummary(file.absolutePath, sourceFile.text, summary);
    return { "file.exportSummary": summary };
  },
};
