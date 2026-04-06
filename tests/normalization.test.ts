import { describe, expect, test } from "bun:test";
import { countLogicalLines } from "../src/facts/ts-helpers";
import { analyzeRepository } from "../src/core/engine";
import { createDefaultRegistry } from "../src/default-registry";
import { DEFAULT_CONFIG } from "../src/config";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tempDirs: string[] = [];

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "repo-slop-normalization-"));
  tempDirs.push(rootDir);
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }
  return rootDir;
}

describe("normalization metrics", () => {
  test("counts logical lines without comment-only and blank lines", () => {
    const text = [
      "// comment only",
      "const value = 1;",
      "",
      "/* block comment */",
      "function run() {",
      "  return value;",
      "}",
      "",
    ].join("\n");

    expect(countLogicalLines(text, "sample.ts")).toBe(4);
  });

  test("analysis summary includes file, KLOC, and function normalization", async () => {
    const rootDir = await createTempRepo({
      "src/one.ts": [
        "export async function wrapper(value: string) {",
        "  return await Promise.resolve(value);",
        "}",
        "",
      ].join("\n"),
      "src/two.ts": [
        "export function plain() {",
        "  return 1;",
        "}",
        "",
      ].join("\n"),
    });

    try {
      const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());
      expect(result.summary.fileCount).toBe(2);
      expect(result.summary.functionCount).toBe(2);
      expect(result.summary.logicalLineCount).toBeGreaterThan(0);
      expect(result.summary.normalized.scorePerFile).not.toBeNull();
      expect(result.summary.normalized.scorePerKloc).not.toBeNull();
      expect(result.summary.normalized.scorePerFunction).not.toBeNull();
      expect(result.summary.normalized.findingsPerFile).not.toBeNull();
      expect(result.summary.normalized.findingsPerKloc).not.toBeNull();
      expect(result.summary.normalized.findingsPerFunction).not.toBeNull();
    } finally {
      await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
    }
  });
});
