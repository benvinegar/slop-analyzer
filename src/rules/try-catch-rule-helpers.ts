import type { TryCatchSummary } from "../facts/types";

export function isValidTryCatchTarget(summary: TryCatchSummary): boolean {
  return summary.hasCatchClause && !summary.isFilesystemExistenceProbe;
}

export function formatTryCatchBoundary(summary: TryCatchSummary): string {
  return summary.boundaryCategories.length > 0 ? summary.boundaryCategories.join("|") : "none";
}

export function scoreTryCatch(summary: TryCatchSummary): number {
  let score = 3;

  if (summary.catchIsEmpty) {
    score += 0.5;
  }

  // Re-throwing a generic error is still noisy, but it is slightly less bad
  // than silently swallowing or flattening the failure into a default.
  if (summary.catchThrowsGeneric) {
    score -= 0.5;
  }

  if (summary.boundaryCategories.length > 0) {
    // Boundary code often logs/translates errors for operational reasons, so we
    // downweight instead of fully exempting it.
    score *= 0.4;
    if (summary.catchIsEmpty) {
      score += 0.5;
    }
  }

  return Math.max(0.75, score);
}
