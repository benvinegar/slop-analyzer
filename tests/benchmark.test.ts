import { describe, expect, test } from "bun:test";
import path from "node:path";
import { loadBenchmarkSet } from "../src/benchmarks/manifest";
import { renderBenchmarkReport } from "../src/benchmarks/report";
import { createBenchmarkSnapshot } from "../src/benchmarks/snapshot";
import type { BenchmarkSet } from "../src/benchmarks/types";
import { analyzeRepository } from "../src/core/engine";
import { DEFAULT_CONFIG } from "../src/config";
import { createDefaultRegistry } from "../src/default-registry";

function fixturePath(name: string): string {
  return path.join(process.cwd(), "tests", "fixtures", "repos", name);
}

describe("benchmark support", () => {
  test("loads the pinned benchmark manifest", async () => {
    const set = await loadBenchmarkSet();

    expect(set.id).toBe("known-ai-vs-solid-oss");
    expect(set.repos.length).toBeGreaterThanOrEqual(10);
    expect(set.repos.some((repo) => repo.id === "gstack" && repo.cohort === "explicit-ai")).toBe(
      true,
    );
    expect(set.repos.some((repo) => repo.id === "ni" && repo.cohort === "mature-oss")).toBe(true);
  });

  test("creates a benchmark snapshot and report from local fixture repos", async () => {
    const fixtureBenchmark: BenchmarkSet = {
      schemaVersion: 1,
      id: "fixture-benchmark",
      name: "Fixture benchmark",
      description: "Small local benchmark for unit coverage.",
      artifacts: {
        checkoutsDir: "benchmarks/.cache/checkouts/fixture-benchmark",
        snapshotPath: "benchmarks/results/fixture-benchmark.json",
        reportPath: "reports/fixture-benchmark.md",
      },
      repos: [
        {
          id: "slop-heavy",
          repo: "fixtures/slop-heavy",
          url: "https://example.invalid/slop-heavy.git",
          cohort: "explicit-ai",
          ref: "1111111",
          createdAt: "2026-01-01T00:00:00Z",
          stars: 0,
          provenance: "Fixture repo with intentionally slop-heavy code.",
        },
        {
          id: "mixed",
          repo: "fixtures/mixed",
          url: "https://example.invalid/mixed.git",
          cohort: "mature-oss",
          ref: "2222222",
          createdAt: "2020-01-01T00:00:00Z",
          stars: 0,
          provenance: "Fixture repo with localized slop.",
        },
      ],
      pairings: [
        {
          aiRepoId: "slop-heavy",
          solidRepoId: "mixed",
          notes: "Fixture pairing for unit coverage.",
        },
      ],
    };

    const registry = createDefaultRegistry();
    const analyses = [
      {
        spec: fixtureBenchmark.repos[0]!,
        result: await analyzeRepository(fixturePath("slop-heavy"), DEFAULT_CONFIG, registry),
      },
      {
        spec: fixtureBenchmark.repos[1]!,
        result: await analyzeRepository(fixturePath("mixed"), DEFAULT_CONFIG, registry),
      },
    ];

    const snapshot = createBenchmarkSnapshot(
      fixtureBenchmark,
      analyses,
      "0.1.0",
      "2026-04-06T00:00:00Z",
    );
    const report = renderBenchmarkReport(fixtureBenchmark, snapshot);

    expect(snapshot.repos).toHaveLength(2);
    expect(snapshot.cohorts["explicit-ai"].repoCount).toBe(1);
    expect(snapshot.cohorts["mature-oss"].repoCount).toBe(1);
    expect(snapshot.cohorts["explicit-ai"].medians.scorePerFile).not.toBeNull();
    expect(snapshot.cohorts["mature-oss"].blendedScoreMedian).not.toBeNull();
    expect(snapshot.repos.every((repo) => repo.blendedScore !== null)).toBe(true);
    expect(snapshot.pairings[0]?.ratios.scorePerFile).not.toBeNull();
    expect(report).toContain("Pinned benchmark: Fixture benchmark");
    expect(report).toContain("Blended score");
    expect(report).toContain("fixtures/slop-heavy");
    expect(report).toContain("fixtures/mixed");
  });
});
