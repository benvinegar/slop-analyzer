import * as ts from "typescript";
import type { FactProvider } from "../core/types";
import type { FunctionSummary } from "./types";
import { getFunctionName, getLineNumber, getNodeStatementCount, hasAwaitExpression, walk } from "./ts-helpers";

function expressionIsPassthrough(
  expression: ts.Expression,
  parameters: string[],
): { isPassThrough: boolean; hasReturnAwaitCall: boolean } {
  const awaited = ts.isAwaitExpression(expression) ? expression.expression : expression;
  const hasReturnAwaitCall = ts.isAwaitExpression(expression) && ts.isCallExpression(awaited);

  if (!ts.isCallExpression(awaited)) {
    return { isPassThrough: false, hasReturnAwaitCall };
  }

  const allArgsAreDirectParams = awaited.arguments.every(
    (argument) => ts.isIdentifier(argument) && parameters.includes(argument.text),
  );

  return {
    isPassThrough: allArgsAreDirectParams,
    hasReturnAwaitCall,
  };
}

function collectFunctionSummary(
  node: ts.FunctionLikeDeclarationBase,
  sourceFile: ts.SourceFile,
): FunctionSummary | null {
  if (!node.body || !ts.isBlock(node.body)) {
    return null;
  }

  const parameters = node.parameters
    .map((parameter) => (ts.isIdentifier(parameter.name) ? parameter.name.text : null))
    .filter((value): value is string => value !== null);

  const statements = node.body.statements;
  let isPassThroughWrapper = false;
  let hasReturnAwaitCall = false;

  if (statements.length === 1) {
    const [statement] = statements;
    if (ts.isReturnStatement(statement) && statement.expression) {
      const passThrough = expressionIsPassthrough(statement.expression, parameters);
      isPassThroughWrapper = passThrough.isPassThrough;
      hasReturnAwaitCall = passThrough.hasReturnAwaitCall;
    }
  }

  return {
    name: getFunctionName(node, sourceFile),
    line: getLineNumber(sourceFile, node.getStart(sourceFile)),
    isAsync: Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword)),
    hasAwait: hasAwaitExpression(node.body),
    statementCount: getNodeStatementCount(node.body),
    isPassThroughWrapper,
    hasReturnAwaitCall,
  };
}

export const functionsFactProvider: FactProvider = {
  id: "fact.file.functions",
  scope: "file",
  requires: ["file.ast"],
  provides: ["file.functionSummaries"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  run(context) {
    const sourceFile = context.runtime.store.getFileFact<ts.SourceFile>(context.file!.path, "file.ast");
    if (!sourceFile) {
      return { "file.functionSummaries": [] satisfies FunctionSummary[] };
    }

    const functions: FunctionSummary[] = [];

    walk(sourceFile, (node) => {
      if (ts.isFunctionDeclaration(node)) {
        const summary = collectFunctionSummary(node, sourceFile);
        if (summary) {
          functions.push(summary);
        }
      }

      if (ts.isMethodDeclaration(node)) {
        const summary = collectFunctionSummary(node, sourceFile);
        if (summary) {
          functions.push(summary);
        }
      }

      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) {
          const summary = collectFunctionSummary(node.initializer, sourceFile);
          if (summary) {
            functions.push(summary);
          }
        }
      }
    });

    return { "file.functionSummaries": functions };
  },
};
