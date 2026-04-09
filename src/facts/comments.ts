import * as ts from "typescript";
import type { FactProvider } from "../core/types";
import type { CommentSummary } from "./types";
import { getLineNumber } from "./ts-helpers";

const COMMENT_PATTERN = /\/\/.*|\/\*[\s\S]*?\*\//g;
const MAX_COMMENT_CACHE_ENTRIES = 500;
const commentCache = new Map<string, { text: string; comments: CommentSummary[] }>();

/** Stores comment summaries for unchanged file text. */
function cacheComments(filePath: string, text: string, comments: CommentSummary[]): void {
  if (!commentCache.has(filePath) && commentCache.size >= MAX_COMMENT_CACHE_ENTRIES) {
    const oldestKey = commentCache.keys().next().value;
    if (oldestKey) {
      commentCache.delete(oldestKey);
    }
  }

  commentCache.set(filePath, { text, comments });
}

export const commentsFactProvider: FactProvider = {
  id: "fact.file.comments",
  scope: "file",
  requires: ["file.text", "file.ast"],
  provides: ["file.comments"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  run(context) {
    const file = context.file;
    const text = context.runtime.store.getFileFact<string>(context.file!.path, "file.text");
    const sourceFile = context.runtime.store.getFileFact<ts.SourceFile>(
      context.file!.path,
      "file.ast",
    );
    if (!file || !text || !sourceFile) {
      return { "file.comments": [] satisfies CommentSummary[] };
    }

    const cached = commentCache.get(file.absolutePath);
    if (cached && cached.text === text) {
      return { "file.comments": cached.comments };
    }

    const comments: CommentSummary[] = [];
    for (const match of text.matchAll(COMMENT_PATTERN)) {
      const value = match[0].trim();
      const index = match.index ?? 0;
      comments.push({ text: value, line: getLineNumber(sourceFile, index) });
    }

    cacheComments(file.absolutePath, text, comments);
    return { "file.comments": comments };
  },
};
