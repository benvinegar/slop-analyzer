import * as ts from "typescript";
import type { FactProvider } from "../core/types";
import type { TryCatchSummary } from "./types";
import { getExpressionPath, getLineNumber, isDefaultLiteral, isLoggingCall, walk } from "./ts-helpers";

const FILE_SYSTEM_ROOTS = new Set(["fs", "fsp", "fsPromises", "promises"]);
const FILE_SYSTEM_METHODS = new Set([
  "access",
  "accessSync",
  "appendFile",
  "appendFileSync",
  "chmod",
  "chmodSync",
  "copyFile",
  "copyFileSync",
  "createReadStream",
  "createWriteStream",
  "existsSync",
  "lstat",
  "lstatSync",
  "mkdir",
  "mkdirSync",
  "mkdtemp",
  "mkdtempSync",
  "open",
  "openSync",
  "readFile",
  "readFileSync",
  "readdir",
  "readdirSync",
  "readlink",
  "readlinkSync",
  "realpath",
  "realpathSync",
  "rename",
  "renameSync",
  "rm",
  "rmSync",
  "stat",
  "statSync",
  "symlink",
  "symlinkSync",
  "unlink",
  "unlinkSync",
  "watch",
  "watchFile",
  "writeFile",
  "writeFileSync",
]);
const PROCESS_METHODS = new Set(["exec", "execFile", "execFileSync", "execSync", "kill", "spawn", "spawnSync"]);
const NETWORK_ROOTS = new Set(["axios", "fetch", "got", "request"]);
const BROWSER_ROOTS = new Set([
  "browser",
  "chrome",
  "context",
  "document",
  "history",
  "localStorage",
  "location",
  "navigator",
  "page",
  "sessionStorage",
  "window",
]);
const BROWSER_METHODS = new Set(["click", "evaluate", "goto", "hover", "reload", "screenshot", "type"]);

function collectBoundaryCategories(node: ts.TryStatement): string[] {
  const categories = new Set<string>();

  walk(node.tryBlock, (child) => {
    if (ts.isCallExpression(child) || ts.isNewExpression(child)) {
      const path = getExpressionPath(ts.isCallExpression(child) ? child.expression : child.expression ?? child);
      if (path.length === 0) {
        return;
      }

      const [root] = path;
      const last = path.at(-1) ?? "";

      if (FILE_SYSTEM_ROOTS.has(root) || FILE_SYSTEM_METHODS.has(last)) {
        categories.add("filesystem");
      }

      if (NETWORK_ROOTS.has(root) || last === "fetch") {
        categories.add("network");
      }

      if (root === "Bun" || root === "Deno" || root === "process" || PROCESS_METHODS.has(last)) {
        categories.add("process");
      }

      if (BROWSER_ROOTS.has(root) || BROWSER_METHODS.has(last)) {
        categories.add("browser");
      }

      if (
        (path.length === 2 && path[0] === "JSON" && path[1] === "parse")
        || (path.length === 2 && path[0] === "process" && path[1] === "env")
      ) {
        categories.add("config");
      }
    }

    if (ts.isPropertyAccessExpression(child)) {
      const path = getExpressionPath(child);
      if (path.length === 2 && path[0] === "process" && path[1] === "env") {
        categories.add("config");
      }
    }
  });

  return [...categories].sort();
}

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
    hasCatchClause: Boolean(node.catchClause),
    tryStatementCount: node.tryBlock.statements.length,
    catchStatementCount: catchStatements.length,
    catchLogsOnly,
    catchReturnsDefault,
    catchHasLogging,
    catchHasDefaultReturn,
    catchIsEmpty: catchStatements.length === 0,
    catchThrowsGeneric,
    boundaryCategories: collectBoundaryCategories(node),
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
