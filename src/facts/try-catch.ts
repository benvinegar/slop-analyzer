import * as ts from "typescript";
import type { FactProvider } from "../core/types";
import type { TryCatchSummary } from "./types";
import { getLineNumber, isDefaultLiteral, isLoggingCall, walk } from "./ts-helpers";

function summarizeTryStatement(node: ts.TryStatement, sourceFile: ts.SourceFile): TryCatchSummary {
  const catchBlock = node.catchClause?.block;
  const catchStatements = catchBlock?.statements ?? [];

  const catchHasLogging = catchStatements.some(
    (statement) => ts.isExpressionStatement(statement) && isLoggingCall(statement.expression),
  );

  const catchHasDefaultReturn = catchStatements.some(
    (statement) => ts.isReturnStatement(statement) && isDefaultLiteral(statement.expression),
  );

  const catchLogsOnly =
    catchStatements.length > 0 &&
    catchStatements.every(
      (statement) => ts.isExpressionStatement(statement) && isLoggingCall(statement.expression),
    );

  const catchReturnsDefault =
    catchStatements.length === 1 &&
    ts.isReturnStatement(catchStatements[0]) &&
    isDefaultLiteral(catchStatements[0].expression);

  const catchThrowsGeneric =
    catchStatements.length === 1 &&
    ts.isThrowStatement(catchStatements[0]) &&
    Boolean(catchStatements[0].expression) &&
    (ts.isNewExpression(catchStatements[0].expression!) || ts.isStringLiteral(catchStatements[0].expression!));

  return {
    line: getLineNumber(sourceFile, node.getStart(sourceFile)),
    tryStatementCount: node.tryBlock.statements.length,
    catchStatementCount: catchStatements.length,
    catchLogsOnly,
    catchReturnsDefault,
    catchHasLogging,
    catchHasDefaultReturn,
    catchIsEmpty: catchStatements.length === 0,
    catchThrowsGeneric,
  };
}

export const tryCatchFactProvider: FactProvider = {
  id: "fact.file.tryCatch",
  scope: "file",
  requires: ["file.ast"],
  provides: ["file.tryCatchSummaries"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  run(context) {
    const sourceFile = context.runtime.store.getFileFact<ts.SourceFile>(context.file!.path, "file.ast");
    if (!sourceFile) {
      return { "file.tryCatchSummaries": [] satisfies TryCatchSummary[] };
    }

    const summaries: TryCatchSummary[] = [];
    walk(sourceFile, (node) => {
      if (ts.isTryStatement(node)) {
        summaries.push(summarizeTryStatement(node, sourceFile));
      }
    });

    return { "file.tryCatchSummaries": summaries };
  },
};
