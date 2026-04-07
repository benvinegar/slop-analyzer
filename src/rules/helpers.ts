import path from "node:path";

// These segments are intentionally conservative. The goal is to recognize common
// asset buckets like icon packs without teaching the analyzer that arbitrary
// directories full of tiny files are always harmless.
const ASSET_LIKE_DIRECTORY_SEGMENTS = new Set(["icon", "icons", "svg", "svgs", "asset", "assets"]);

// Thin wrappers around these targets are often boundary/framework adapters, so
// rules such as async-noise and pass-through-wrappers treat them more leniently.
const BOUNDARY_WRAPPER_TARGET_PREFIXES = [
  "prisma.",
  "redis.",
  "jwt.",
  "bcrypt.",
  "response.",
  "Response.",
  "fetch",
  "axios.",
  "crypto.",
  "storage.",
];

export function ratio(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

export function countMatching<T>(values: T[], predicate: (value: T) => boolean): number {
  return values.reduce((total, value) => total + (predicate(value) ? 1 : 0), 0);
}

export function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? 0;
  }

  const left = sorted[middle - 1] ?? 0;
  const right = sorted[middle] ?? 0;
  return (left + right) / 2;
}

/**
 * Treat icon/svg/asset folders specially so structural rules do not confuse a
 * generated asset pack with a suspiciously fragmented code directory.
 */
export function isAssetLikeDirectoryPath(directoryPath: string): boolean {
  return directoryPath
    .split("/")
    .map((segment) => segment.toLowerCase())
    .some((segment) => ASSET_LIKE_DIRECTORY_SEGMENTS.has(segment));
}

export function parentDirectoryPath(directoryPath: string): string {
  return path.posix.dirname(directoryPath);
}

/**
 * Returns true for wrapper targets that usually sit at a system boundary, where
 * thin adapters are often intentional and not just slop.
 */
export function isBoundaryWrapperTarget(target: string | null): boolean {
  if (!target) {
    return false;
  }

  return BOUNDARY_WRAPPER_TARGET_PREFIXES.some((prefix) => target.startsWith(prefix));
}
