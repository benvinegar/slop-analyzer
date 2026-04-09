import type { RulePlugin } from "../core/types";
import type { CommentSummary, FunctionSummary } from "../facts/types";
import { BOUNDARY_WRAPPER_TARGET_PREFIXES } from "./helpers";

// Nearby wording like "alias" or "backward compatibility" usually means the
// wrapper exists to preserve an API name rather than because the author lazily
// introduced another layer.
const ALIAS_COMMENT_PATTERNS = [
  /\balias\b/i,
  /backward\s+compat/i,
  /backwards\s+compat/i,
  /backward\s+compatibility/i,
  /legacy/i,
  /keep\s+the\s+old\s+name/i,
];

/**
 * Returns true when the wrapper is immediately preceded by a compatibility
 * comment. We only look one or two lines upward to keep the association tight
 * and avoid broad file-level exemptions.
 */
function hasNearbyAliasComment(summary: FunctionSummary, comments: CommentSummary[]): boolean {
  return comments.some((comment) => {
    const lineDelta = summary.line - comment.line;
    return (
      lineDelta >= 1 &&
      lineDelta <= 2 &&
      ALIAS_COMMENT_PATTERNS.some((pattern) => pattern.test(comment.text))
    );
  });
}

/**
 * Flags trivial pass-through wrappers that mostly just rename or forward a call.
 *
 * The main exemptions are:
 * - compatibility/alias wrappers documented by nearby comments
 * - boundary/framework wrappers where keeping an abstraction layer is often
 *   intentional even if the body is mechanically thin
 */
export const passThroughWrappersRule: RulePlugin = {
  id: "structure.pass-through-wrappers",
  family: "structure",
  severity: "strong",
  scope: "file",
  requires: ["file.functionSummaries", "file.comments"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  evaluate(context) {
    const functions =
      context.runtime.store.getFileFact<FunctionSummary[]>(
        context.file!.path,
        "file.functionSummaries",
      ) ?? [];
    const comments =
      context.runtime.store.getFileFact<CommentSummary[]>(context.file!.path, "file.comments") ??
      [];

    const wrappers = functions.filter(
      (summary) =>
        summary.isPassThroughWrapper &&
        !hasNearbyAliasComment(summary, comments) &&
        !BOUNDARY_WRAPPER_TARGET_PREFIXES.some((prefix) =>
          summary.passThroughTarget?.startsWith(prefix),
        ),
    );

    if (wrappers.length === 0) {
      return [];
    }

    return [
      {
        ruleId: "structure.pass-through-wrappers",
        family: "structure",
        severity: "strong",
        scope: "file",
        path: context.file!.path,
        message: `Found ${wrappers.length} pass-through wrapper${wrappers.length === 1 ? "" : "s"}`,
        evidence: wrappers.map(
          (summary) =>
            `${summary.name} at line ${summary.line}${summary.passThroughTarget ? ` -> ${summary.passThroughTarget}` : ""}`,
        ),
        // Each wrapper matters, but cap the file contribution so one adapter file
        // cannot swamp the repo score by itself.
        score: Math.min(5, wrappers.length * 2),
        locations: wrappers.map((summary) => ({ path: context.file!.path, line: summary.line })),
      },
    ];
  },
};
