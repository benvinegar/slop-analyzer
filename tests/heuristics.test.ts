import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeRepository } from "../src/core/engine";
import { DEFAULT_CONFIG } from "../src/config";
import { createDefaultRegistry } from "../src/default-registry";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function writeRepoFiles(rootDir: string, files: Record<string, string>): Promise<void> {
  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(rootDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }
}

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "repo-slop-analyzer-heuristics-"));
  tempDirs.push(rootDir);
  await writeRepoFiles(rootDir, files);
  return rootDir;
}

describe("heuristic rule pack", () => {
  test("detects the initial slop heuristics on a slop-heavy repo", async () => {
    const rootDir = await createTempRepo({
      "src/a.ts": "export const a = 1;\n",
      "src/b.ts": "export const b = 2;\n",
      "src/index.ts": 'export * from "./a";\nexport * from "./b";\n',
      "src/comments.ts": "// Add more validation if needed\nexport const commentExample = true;\n",
      "src/error.ts": [
        "export function safeParse(json: string) {",
        "  try {",
        "    return JSON.parse(json);",
        "  } catch (error) {",
        '    console.error("parse failed", error);',
        "    return null;",
        "  }",
        "}",
        "",
      ].join("\n"),
      "src/service.ts": [
        "function getData(id: string) {",
        "  return Promise.resolve(id);",
        "}",
        "",
        "export async function fetchData(id: string) {",
        "  return await getData(id);",
        "}",
        "",
        "export function wrap(id: string) {",
        "  return getData(id);",
        "}",
        "",
      ].join("\n"),
      "src/solo-a/only.ts": "export const onlyA = true;\n",
      "src/solo-b/only.ts": "export const onlyB = true;\n",
      "src/fragments/file1.ts": "export const value1 = 1;\n",
      "src/fragments/file2.ts": "export const value2 = 2;\n",
      "src/fragments/file3.ts": "export const value3 = 3;\n",
      "src/fragments/file4.ts": "export const value4 = 4;\n",
      "src/fragments/file5.ts": "export const value5 = 5;\n",
      "src/fragments/file6.ts": "export const value6 = 6;\n",
      "src/fragments/file7.ts": "export const value7 = 7;\n",
    });

    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());
    const ruleIds = new Set(result.findings.map((finding) => finding.ruleId));

    expect(ruleIds.has("comments.placeholder-comments")).toBe(true);
    expect(ruleIds.has("defensive.needless-try-catch")).toBe(true);
    expect(ruleIds.has("defensive.async-noise")).toBe(true);
    expect(ruleIds.has("structure.pass-through-wrappers")).toBe(true);
    expect(ruleIds.has("structure.barrel-density")).toBe(true);
    expect(ruleIds.has("structure.over-fragmentation")).toBe(true);
    expect(ruleIds.has("structure.directory-fanout-hotspot")).toBe(true);

    expect(result.fileScores.some((score) => score.path === "src/service.ts")).toBe(true);
    expect(result.directoryScores[0]?.path).toBe("src/fragments");
    expect(result.repoScore).toBeGreaterThan(0);
  });

  test("stays quiet on a small clean repo", async () => {
    const rootDir = await createTempRepo({
      "src/index.ts": [
        "export function sum(values: number[]) {",
        "  return values.reduce((total, value) => total + value, 0);",
        "}",
        "",
      ].join("\n"),
      "src/math.ts": [
        "export function multiply(left: number, right: number) {",
        "  return left * right;",
        "}",
        "",
      ].join("\n"),
    });

    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());

    expect(result.findings).toHaveLength(0);
    expect(result.repoScore).toBe(0);
  });
});
