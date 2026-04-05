import * as ts from "typescript";
import type { FactProvider } from "../core/types";
import { getScriptKind } from "./ts-helpers";

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

    const sourceFile = ts.createSourceFile(
      file.path,
      file.text,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(file.path),
    );

    return { "file.ast": sourceFile };
  },
};
