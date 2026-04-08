import { describe, expect, test } from "bun:test";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { analyzeRepository } from "../src/core/engine";
import { DEFAULT_CONFIG } from "../src/config";
import { createDefaultRegistry } from "../src/default-registry";

function fixturePath(name: string): string {
  return path.join(process.cwd(), "tests", "fixtures", "repos", name);
}

describe("fixture regression suite", () => {
  test("clean fixture stays quiet", async () => {
    const result = await analyzeRepository(
      fixturePath("clean"),
      DEFAULT_CONFIG,
      createDefaultRegistry(),
    );

    expect(result.findings).toHaveLength(0);
    expect(result.repoScore).toBe(0);
  });

  test("slop-heavy fixture keeps a stable rule footprint", async () => {
    const result = await analyzeRepository(
      fixturePath("slop-heavy"),
      DEFAULT_CONFIG,
      createDefaultRegistry(),
    );

    expect(result.repoScore).toBeCloseTo(28.2833333333, 6);
    expect(result.findings).toHaveLength(8);
    expect([...new Set(result.findings.map((finding) => finding.ruleId))].sort()).toEqual([
      "comments.placeholder-comments",
      "defensive.async-noise",
      "defensive.needless-try-catch",
      "structure.barrel-density",
      "structure.directory-fanout-hotspot",
      "structure.over-fragmentation",
      "structure.pass-through-wrappers",
    ]);
    expect(result.fileScores.map((score) => score.path)).toEqual([
      "src/service.ts",
      "src/index.ts",
      "src/error.ts",
      "src/comments.ts",
    ]);
    expect(result.directoryScores.map((score) => score.path)).toEqual(["src/fragments", "src"]);
  });

  test("mixed fixture localizes hotspots to the slop subtree", async () => {
    const result = await analyzeRepository(
      fixturePath("mixed"),
      DEFAULT_CONFIG,
      createDefaultRegistry(),
    );

    expect(result.repoScore).toBeCloseTo(27.1166666667, 6);
    expect(result.fileScores[0]?.path).toBe("src/slop/service.ts");
    expect(result.directoryScores[0]?.path).toBe("src/slop");
    expect(result.fileScores.every((score) => score.path.startsWith("src/slop/"))).toBe(true);
  });

  test("CLI JSON output matches the slop-heavy fixture summary", () => {
    const output = spawnSync(
      "bun",
      ["run", "src/cli.ts", "scan", fixturePath("slop-heavy"), "--json"],
      {
        encoding: "utf8",
      },
    );

    expect(output.status).toBe(0);

    const report = JSON.parse(output.stdout);
    expect(report.summary.repoScore).toBeCloseTo(28.2833333333, 6);
    expect(report.summary.findingCount).toBe(8);
    expect(report.directoryScores[0].path).toBe("src/fragments");
    expect(report.fileScores[0].path).toBe("src/service.ts");
  });

  test("CLI lint output lists grouped rule hits with locations", () => {
    const output = spawnSync(
      "bun",
      ["run", "src/cli.ts", "scan", fixturePath("slop-heavy"), "--lint"],
      {
        encoding: "utf8",
      },
    );

    expect(output.status).toBe(0);
    expect(output.stdout).toContain(
      "weak  Found 1 placeholder-style comments  comments.placeholder-comments",
    );
    expect(output.stdout).toContain("  at src/comments.ts:1:1");
    expect(output.stdout).toContain(
      "strong  Found 1 defensive try/catch block  defensive.needless-try-catch",
    );
    expect(output.stdout).toContain("  at src/error.ts:2:1");
    expect(output.stdout).toContain(
      "medium  File is primarily a barrel with 2 re-export statements  structure.barrel-density",
    );
    expect(output.stdout).toContain("  at src/index.ts:1:1");
    expect(output.stdout).toContain("8 findings");
    expect(output.stdout).not.toContain("slop-scan report");
  });

  test("CLI rejects --json and --lint together", () => {
    const output = spawnSync(
      "bun",
      ["run", "src/cli.ts", "scan", fixturePath("slop-heavy"), "--json", "--lint"],
      {
        encoding: "utf8",
      },
    );

    expect(output.status).toBe(1);
    expect(output.stderr).toContain("--json and --lint cannot be used together.");
  });
});
