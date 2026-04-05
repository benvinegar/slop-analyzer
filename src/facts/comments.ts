import type { FactProvider } from "../core/types";
import type { CommentSummary } from "./types";
import { getLineNumber } from "./ts-helpers";
import * as ts from "typescript";

const COMMENT_PATTERN = /\/\/.*|\/\*[\s\S]*?\*\//g;

export const commentsFactProvider: FactProvider = {
  id: "fact.file.comments",
  scope: "file",
  requires: ["file.text", "file.ast"],
  provides: ["file.comments"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  run(context) {
    const text = context.runtime.store.getFileFact<string>(context.file!.path, "file.text") ?? context.file!.text;
    const sourceFile = context.runtime.store.getFileFact<ts.SourceFile>(context.file!.path, "file.ast");
    if (!sourceFile) {
      return { "file.comments": [] satisfies CommentSummary[] };
    }

    const comments: CommentSummary[] = [];
    for (const match of text.matchAll(COMMENT_PATTERN)) {
      const value = match[0].trim();
      const index = match.index ?? 0;
      comments.push({ text: value, line: getLineNumber(sourceFile, index) });
    }

    return { "file.comments": comments };
  },
};
