import { createHash } from "node:crypto";
import * as ts from "typescript";
import type { FactProvider } from "../core/types";
import type { FunctionSummary } from "./types";
import {
  countNodes,
  getExpressionPath,
  getFunctionName,
  getLineNumber,
  getNodeStatementCount,
  hasAwaitExpression,
  isTestFile,
  walk,
} from "./ts-helpers";

const MIN_DUPLICATE_STATEMENT_COUNT = 2;
const MIN_DUPLICATE_NODE_COUNT = 16;

function expressionIsPassthrough(
  expression: ts.Expression,
  parameters: string[],
): { isPassThrough: boolean; passThroughTarget: string | null; hasReturnAwaitCall: boolean } {
  const awaited = ts.isAwaitExpression(expression) ? expression.expression : expression;
  const hasReturnAwaitCall = ts.isAwaitExpression(expression) && ts.isCallExpression(awaited);

  if (!ts.isCallExpression(awaited)) {
    return { isPassThrough: false, passThroughTarget: null, hasReturnAwaitCall };
  }

  const allArgsAreDirectParams = awaited.arguments.every(
    (argument) => ts.isIdentifier(argument) && parameters.includes(argument.text),
  );
  const path = getExpressionPath(awaited.expression);

  return {
    isPassThrough: allArgsAreDirectParams,
    passThroughTarget: path.length > 0 ? path.join(".") : null,
    hasReturnAwaitCall,
  };
}

function collectLocalNames(node: ts.FunctionLikeDeclarationBase): Set<string> {
  const names = new Set<string>();

  for (const parameter of node.parameters) {
    if (ts.isIdentifier(parameter.name)) {
      names.add(parameter.name.text);
    }
  }

  if (!node.body || !ts.isBlock(node.body)) {
    return names;
  }

  walk(node.body, (child) => {
    if (ts.isVariableDeclaration(child) && ts.isIdentifier(child.name)) {
      names.add(child.name.text);
    }

    if (ts.isCatchClause(child) && child.variableDeclaration && ts.isIdentifier(child.variableDeclaration.name)) {
      names.add(child.variableDeclaration.name.text);
    }

    if ((ts.isFunctionDeclaration(child) || ts.isClassDeclaration(child)) && child.name) {
      names.add(child.name.text);
    }
  });

  return names;
}

function serializeDuplicateFingerprintNode(node: ts.Node, localNames: Set<string>): string {
  if (ts.isIdentifier(node)) {
    return localNames.has(node.text) ? "local" : `id:${node.text}`;
  }

  if (ts.isPrivateIdentifier(node)) {
    return "private";
  }

  if (
    ts.isStringLiteralLike(node)
    || ts.isNumericLiteral(node)
    || ts.isNoSubstitutionTemplateLiteral(node)
    || ts.isTemplateHead(node)
    || ts.isTemplateMiddle(node)
    || ts.isTemplateTail(node)
  ) {
    return `literal:${ts.SyntaxKind[node.kind]}`;
  }

  const label = ts.SyntaxKind[node.kind];
  const children: string[] = [];
  node.forEachChild((child) => {
    children.push(serializeDuplicateFingerprintNode(child, localNames));
  });

  return children.length === 0 ? label : `${label}(${children.join(",")})`;
}

function buildDuplicationFingerprint(
  node: ts.FunctionLikeDeclarationBase,
  isAsync: boolean,
  parameterCount: number,
  statementCount: number,
  isPassThroughWrapper: boolean,
): string | null {
  if (!node.body || !ts.isBlock(node.body) || isPassThroughWrapper || statementCount < MIN_DUPLICATE_STATEMENT_COUNT) {
    return null;
  }

  if (countNodes(node.body) < MIN_DUPLICATE_NODE_COUNT) {
    return null;
  }

  const localNames = collectLocalNames(node);
  const semanticShape = serializeDuplicateFingerprintNode(node.body, localNames);
  const hash = createHash("sha1").update(semanticShape).digest("hex");
  return `${isAsync ? "async" : "sync"}:${parameterCount}:${statementCount}:${hash}`;
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

  const parameterCount = node.parameters.length;
  const isAsync = Boolean(node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword));
  const statements = node.body.statements;
  const statementCount = getNodeStatementCount(node.body);
  let isPassThroughWrapper = false;
  let passThroughTarget: string | null = null;
  let hasReturnAwaitCall = false;

  if (statements.length === 1) {
    const [statement] = statements;
    if (ts.isReturnStatement(statement) && statement.expression) {
      const passThrough = expressionIsPassthrough(statement.expression, parameters);
      isPassThroughWrapper = passThrough.isPassThrough;
      passThroughTarget = passThrough.passThroughTarget;
      hasReturnAwaitCall = passThrough.hasReturnAwaitCall;
    }
  }

  return {
    name: getFunctionName(node, sourceFile),
    line: getLineNumber(sourceFile, node.getStart(sourceFile)),
    parameterCount,
    isAsync,
    hasAwait: isAsync ? hasAwaitExpression(node.body) : false,
    statementCount,
    isPassThroughWrapper,
    passThroughTarget,
    hasReturnAwaitCall,
    duplicationFingerprint: isTestFile(sourceFile.fileName)
      ? null
      : buildDuplicationFingerprint(node, isAsync, parameterCount, statementCount, isPassThroughWrapper),
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
