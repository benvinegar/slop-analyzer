import * as ts from "typescript";
import type { FactProvider } from "../core/types";
import { getScriptKind } from "./ts-helpers";

const MAX_AST_CACHE_ENTRIES = 500;
const astCache = new Map<string, { text: string; sourceFile: ts.SourceFile }>();

/** Stores parsed ASTs for unchanged file text. */
function cacheSourceFile(filePath: string, text: string, sourceFile: ts.SourceFile): void {
  if (!astCache.has(filePath) && astCache.size >= MAX_AST_CACHE_ENTRIES) {
    const oldestKey = astCache.keys().next().value;
    if (oldestKey) {
      astCache.delete(oldestKey);
    }
  }

  astCache.set(filePath, { text, sourceFile });
}

export const astFactProvider: FactProvider = {
  id: "fact.file.ast",
  scope: "file",
  requires: ["file.record", "file.text"],
  provides: ["file.ast"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  run(context) {
    const file = context.file;
    if (!file) {
      return {};
    }

    const text = context.runtime.store.getFileFact<string>(file.path, "file.text");
    if (text === undefined) {
      return {};
    }

    const cached = astCache.get(file.absolutePath);
    if (cached && cached.text === text) {
      return { "file.ast": cached.sourceFile };
    }

    const sourceFile = ts.createSourceFile(
      file.path,
      text,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(file.path),
    );

    cacheSourceFile(file.absolutePath, text, sourceFile);
    return { "file.ast": sourceFile };
  },
};
