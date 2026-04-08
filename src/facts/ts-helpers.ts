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

export function countPhysicalLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  let lines = 1;
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) {
      lines += 1;
    }
  }

  return lines;
}

export function countLogicalLines(text: string, filePath: string): number {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    getLanguageVariant(filePath),
    text,
  );
  let cursor = 0;
  let currentLine = 1;
  let lastLogicalLine = 0;
  let logicalLineCount = 0;

  let token = scanner.scan();
  while (token !== ts.SyntaxKind.EndOfFileToken) {
    const tokenPos = scanner.getTokenPos();

    while (cursor < tokenPos) {
      const char = text.charCodeAt(cursor);
      if (char === 13) {
        currentLine += 1;
        if (text.charCodeAt(cursor + 1) === 10) {
          cursor += 1;
        }
      } else if (char === 10) {
        currentLine += 1;
      }
      cursor += 1;
    }

    if (currentLine !== lastLogicalLine) {
      logicalLineCount += 1;
      lastLogicalLine = currentLine;
    }

    token = scanner.scan();
  }

  return logicalLineCount;
}

export function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

export function countNodes(node: ts.Node): number {
  let count = 0;
  walk(node, () => {
    count += 1;
  });
  return count;
}

export function isTestFile(filePath: string): boolean {
  return (
    filePath.includes("/__tests__/") ||
    filePath.includes("/tests/") ||
    filePath.includes("/test/") ||
    /(?:\.|-|_)test\.[cm]?[jt]sx?$/.test(filePath) ||
    /(?:\.|-|_)spec\.[cm]?[jt]sx?$/.test(filePath)
  );
}

export function fingerprintNodeShape(node: ts.Node, maxDepth = 4): string {
  const parts: string[] = [];

  function visit(current: ts.Node, depth: number): void {
    const label = ts.SyntaxKind[current.kind];
    if (depth >= maxDepth) {
      parts.push(label);
      return;
    }

    const children = current
      .getChildren()
      .filter(
        (child) =>
          child.kind !== ts.SyntaxKind.SyntaxList && child.kind !== ts.SyntaxKind.EndOfFileToken,
      );

    if (children.length === 0) {
      parts.push(label);
      return;
    }

    parts.push(label, "(");
    for (let index = 0; index < children.length; index += 1) {
      if (index > 0) {
        parts.push(",");
      }
      visit(children[index]!, depth + 1);
    }
    parts.push(")");
  }

  visit(node, 0);
  return parts.join("");
}

export function getNodeStatementCount(node: ts.Block | undefined): number {
  return node?.statements.length ?? 0;
}

export function getFunctionName(
  node: ts.FunctionLikeDeclarationBase,
  sourceFile: ts.SourceFile,
): string {
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
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression)
  ) {
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

  if (
    unwrapped.kind === ts.SyntaxKind.NullKeyword ||
    unwrapped.kind === ts.SyntaxKind.FalseKeyword
  ) {
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
