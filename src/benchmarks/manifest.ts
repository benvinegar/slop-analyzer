import { readFile } from "node:fs/promises";
import path from "node:path";
import type { BenchmarkSet } from "./types";

export const DEFAULT_BENCHMARK_SET_PATH = path.resolve(
  process.cwd(),
  "benchmarks/sets/known-ai-vs-solid-oss.json",
);

export async function loadBenchmarkSet(
  manifestPath = DEFAULT_BENCHMARK_SET_PATH,
): Promise<BenchmarkSet> {
  const raw = await readFile(manifestPath, "utf8");
  return JSON.parse(raw) as BenchmarkSet;
}

export function resolveProjectPath(relativePath: string): string {
  return path.resolve(process.cwd(), relativePath);
}
