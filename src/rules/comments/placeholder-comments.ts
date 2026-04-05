import type { RulePlugin } from "../../core/types";
import type { CommentSummary } from "../../facts/types";

const PLACEHOLDER_PATTERNS = [
  /additional\s+cases?/i,
  /if\s+needed/i,
  /as\s+needed/i,
  /can\s+be\s+extended/i,
  /extend\s+this/i,
  /customize\s+this/i,
  /future\s+enhancement/i,
  /handle\s+more/i,
  /add\s+more\s+validation/i,
];

export const placeholderCommentsRule: RulePlugin = {
  id: "comments.placeholder-comments",
  family: "comments",
  severity: "weak",
  scope: "file",
  requires: ["file.comments"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  evaluate(context) {
    const comments =
      context.runtime.store.getFileFact<CommentSummary[]>(context.file!.path, "file.comments") ?? [];
    const matches = comments.filter((comment) =>
      PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(comment.text)),
    );

    if (matches.length === 0) {
      return [];
    }

    return [
      {
        ruleId: "comments.placeholder-comments",
        family: "comments",
        severity: "weak",
        scope: "file",
        path: context.file!.path,
        message: `Found ${matches.length} placeholder-style comments`,
        evidence: matches.map((match) => match.text),
        score: Math.min(1.5, matches.length * 0.75),
        locations: matches.map((match) => ({ path: context.file!.path, line: match.line })),
      },
    ];
  },
};
