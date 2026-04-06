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

function getLanguageVariant(filePath: string): ts.LanguageVariant {
  return filePath.endsWith(".tsx") || filePath.endsWith(".jsx")
    ? ts.LanguageVariant.JSX
    : ts.LanguageVariant.Standard;
}

export function getLineNumber(sourceFile: ts.SourceFile, position: number): number {
  return sourceFile.getLineAndCharacterOfPosition(position).line + 1;
}

export function countLogicalLines(text: string, filePath: string): number {
  const sourceFile = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, getScriptKind(filePath));
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, getLanguageVariant(filePath), text);
  const logicalLines = new Set<number>();

  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    const tokenLine = sourceFile.getLineAndCharacterOfPosition(scanner.getTokenPos()).line + 1;
    logicalLines.add(tokenLine);
    token = scanner.scan();
  }

  return logicalLines.size;
}

export function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

export function isTestFile(filePath: string): boolean {
  return (
    filePath.includes("/__tests__/")
    || filePath.includes("/tests/")
    || filePath.includes("/test/")
    || /(?:\.|-|_)test\.[cm]?[jt]sx?$/.test(filePath)
    || /(?:\.|-|_)spec\.[cm]?[jt]sx?$/.test(filePath)
  );
}

export function fingerprintNodeShape(node: ts.Node, maxDepth = 4): string {
  function visit(current: ts.Node, depth: number): string {
    const label = ts.SyntaxKind[current.kind];
    if (depth >= maxDepth) {
      return label;
    }

    const children = current.getChildren().filter(
      (child) => child.kind !== ts.SyntaxKind.SyntaxList && child.kind !== ts.SyntaxKind.EndOfFileToken,
    );

    if (children.length === 0) {
      return label;
    }

    return `${label}(${children.map((child) => visit(child, depth + 1)).join(",")})`;
  }

  return visit(node, 0);
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

export function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) {
    return unwrapExpression(expression.expression);
  }

  if (ts.isNonNullExpression(expression)) {
    return unwrapExpression(expression.expression);
  }

  return expression;
}

export function getExpressionPath(expression: ts.Expression): string[] {
  const unwrapped = unwrapExpression(expression);

  if (ts.isIdentifier(unwrapped)) {
    return [unwrapped.text];
  }

  if (ts.isPropertyAccessExpression(unwrapped)) {
    return [...getExpressionPath(unwrapped.expression), unwrapped.name.text];
  }

  if (ts.isElementAccessExpression(unwrapped)) {
    const base = getExpressionPath(unwrapped.expression);
    if (ts.isStringLiteral(unwrapped.argumentExpression)) {
      return [...base, unwrapped.argumentExpression.text];
    }
    return base;
  }

  if (ts.isCallExpression(unwrapped)) {
    return getExpressionPath(unwrapped.expression);
  }

  if (ts.isNewExpression(unwrapped) && unwrapped.expression) {
    return getExpressionPath(unwrapped.expression);
  }

  return [];
}

export function isDefaultLiteral(expression: ts.Expression | undefined): boolean {
  if (!expression) {
    return true;
  }

  const unwrapped = unwrapExpression(expression);

  if (unwrapped.kind === ts.SyntaxKind.NullKeyword || unwrapped.kind === ts.SyntaxKind.FalseKeyword) {
    return true;
  }

  if (ts.isIdentifier(unwrapped) && unwrapped.text === "undefined") {
    return true;
  }

  if (ts.isStringLiteral(unwrapped) && unwrapped.text === "") {
    return true;
  }

  if (ts.isArrayLiteralExpression(unwrapped) && unwrapped.elements.length === 0) {
    return true;
  }

  if (ts.isObjectLiteralExpression(unwrapped) && unwrapped.properties.length === 0) {
    return true;
  }

  if (ts.isNumericLiteral(unwrapped) && unwrapped.text === "0") {
    return true;
  }

  return false;
}
