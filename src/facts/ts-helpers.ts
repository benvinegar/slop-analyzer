import path from "node:path";
import * as ts from "typescript";

export function getScriptKind(filePath: string): ts.ScriptKind {
  switch (path.extname(filePath)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
      return ts.ScriptKind.JS;
    case ".mjs":
      return ts.ScriptKind.JS;
    case ".cjs":
      return ts.ScriptKind.JS;
    case ".ts":
    default:
      return ts.ScriptKind.TS;
  }
}

export function getLineNumber(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

export function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

export function getNodeStatementCount(node: ts.Block | undefined): number {
  return node?.statements.length ?? 0;
}

export function getFunctionName(node: ts.FunctionLikeDeclarationBase, sourceFile: ts.SourceFile): string {
  if (node.name && ts.isIdentifier(node.name)) {
    return node.name.text;
  }

  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    const parent = node.parent;
    if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
      return parent.name.text;
    }
  }

  return `<anonymous:${getLineNumber(sourceFile, node.getStart(sourceFile))}>`;
}

export function hasAwaitExpression(node: ts.Node): boolean {
  let found = false;
  walk(node, (nextNode) => {
    if (ts.isAwaitExpression(nextNode)) {
      found = true;
    }
  });
  return found;
}

export function isLoggingCall(expression: ts.Expression): boolean {
  if (!ts.isCallExpression(expression) || !ts.isPropertyAccessExpression(expression.expression)) {
    return false;
  }

  const targetText = expression.expression.expression.getText();
  return targetText === "console" || targetText === "logger";
}

export function isDefaultLiteral(expression: ts.Expression | undefined): boolean {
  if (!expression) {
    return true;
  }

  if (expression.kind === ts.SyntaxKind.NullKeyword || expression.kind === ts.SyntaxKind.FalseKeyword) {
    return true;
  }

  if (ts.isIdentifier(expression) && expression.text === "undefined") {
    return true;
  }

  if (ts.isStringLiteral(expression) && expression.text === "") {
    return true;
  }

  if (ts.isArrayLiteralExpression(expression) && expression.elements.length === 0) {
    return true;
  }

  if (ts.isObjectLiteralExpression(expression) && expression.properties.length === 0) {
    return true;
  }

  if (ts.isNumericLiteral(expression) && expression.text === "0") {
    return true;
  }

  return false;
}
