import { describe, expect, test } from "bun:test";
import { lintReporter } from "../src/reporters/lint";
import type { AnalysisResult } from "../src/core/types";

function createBaseResult(): AnalysisResult {
  return {
    rootDir: "/tmp/example",
    config: { ignores: [], rules: {}, thresholds: {} },
    summary: {
      fileCount: 1,
      directoryCount: 1,
      findingCount: 0,
      repoScore: 0,
      physicalLineCount: 0,
      logicalLineCount: 0,
      functionCount: 0,
      normalized: {
        scorePerFile: 0,
        scorePerKloc: 0,
        scorePerFunction: 0,
        findingsPerFile: 0,
        findingsPerKloc: 0,
        findingsPerFunction: 0,
      },
    },
    files: [],
    directories: [],
    findings: [],
    fileScores: [],
    directoryScores: [],
    repoScore: 0,
  };
}

describe("lint reporter", () => {
  test("shows multiple files and truncates per-file and overall file lists", () => {
    const result = createBaseResult();
    result.findings = [
      {
        ruleId: "tests.duplicate-mock-setup",
        family: "tests",
        severity: "medium",
        scope: "file",
        path: "packages/rutabaga/src/registry.test.ts",
        message: "Found 11 duplicated test mock/setup patterns",
        evidence: [],
        score: 5,
        locations: [
          { path: "packages/rutabaga/src/registry.test.ts", line: 73, column: 1 },
          { path: "packages/rutabaga/src/registry.test.ts", line: 74, column: 1 },
          { path: "packages/rutabaga/src/registry.test.ts", line: 487, column: 1 },
          { path: "packages/rutabaga/src/registry.test.ts", line: 488, column: 1 },
          { path: "packages/rutabaga/src/registry.test.ts", line: 489, column: 1 },
          { path: "packages/rutabaga/src/router.test.ts", line: 10, column: 1 },
          { path: "packages/rutabaga/src/router.test.ts", line: 11, column: 1 },
          { path: "packages/rutabaga/src/router.test.ts", line: 12, column: 1 },
          { path: "packages/rutabaga/src/batch.test.ts", line: 3, column: 1 },
          { path: "packages/rutabaga/src/fallback.test.ts", line: 9, column: 1 },
          { path: "packages/rutabaga/src/fallback.test.ts", line: 20, column: 1 },
          { path: "packages/rutabaga/src/alpha.test.ts", line: 6, column: 1 },
          { path: "packages/rutabaga/src/beta.test.ts", line: 7, column: 1 },
          { path: "packages/rutabaga/src/gamma.test.ts", line: 8, column: 1 },
        ],
      },
      {
        ruleId: "tests.duplicate-mock-setup",
        family: "tests",
        severity: "medium",
        scope: "file",
        path: "packages/rutabaga/src/router.test.ts",
        message: "Found 11 duplicated test mock/setup patterns",
        evidence: [],
        score: 5,
        locations: [
          { path: "packages/rutabaga/src/registry.test.ts", line: 73, column: 1 },
          { path: "packages/rutabaga/src/registry.test.ts", line: 74, column: 1 },
          { path: "packages/rutabaga/src/registry.test.ts", line: 487, column: 1 },
          { path: "packages/rutabaga/src/registry.test.ts", line: 488, column: 1 },
          { path: "packages/rutabaga/src/registry.test.ts", line: 489, column: 1 },
          { path: "packages/rutabaga/src/router.test.ts", line: 10, column: 1 },
          { path: "packages/rutabaga/src/router.test.ts", line: 11, column: 1 },
          { path: "packages/rutabaga/src/router.test.ts", line: 12, column: 1 },
          { path: "packages/rutabaga/src/batch.test.ts", line: 3, column: 1 },
          { path: "packages/rutabaga/src/fallback.test.ts", line: 9, column: 1 },
          { path: "packages/rutabaga/src/fallback.test.ts", line: 20, column: 1 },
          { path: "packages/rutabaga/src/alpha.test.ts", line: 6, column: 1 },
          { path: "packages/rutabaga/src/beta.test.ts", line: 7, column: 1 },
          { path: "packages/rutabaga/src/gamma.test.ts", line: 8, column: 1 },
        ],
      },
    ];

    const output = lintReporter.render(result);

    expect(output).toContain("medium  Found 11 duplicated test mock/setup patterns  tests.duplicate-mock-setup");
    expect(output).toContain("  at packages/rutabaga/src/alpha.test.ts:6:1");
    expect(output).toContain("  at packages/rutabaga/src/batch.test.ts:3:1");
    expect(output).toContain("  at packages/rutabaga/src/beta.test.ts:7:1");
    expect(output).toContain("  at packages/rutabaga/src/fallback.test.ts:9:1, 20:1");
    expect(output).toContain("  at packages/rutabaga/src/gamma.test.ts:8:1");
    expect(output).toContain("  ... and 2 more files");
    expect(output).not.toContain("packages/rutabaga/src/registry.test.ts:73:1");
    expect(output).toContain("1 finding");
  });
});
