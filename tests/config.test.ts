import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeRepository } from "../src/core/engine";
import type { AnalyzerConfig } from "../src/config";
import { DEFAULT_CONFIG, loadConfig } from "../src/config";
import { createDefaultRegistry } from "../src/default-registry";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTempRepo(): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "slop-scan-config-"));
  tempDirs.push(rootDir);
  await mkdir(path.join(rootDir, "src"), { recursive: true });
  await writeFile(
    path.join(rootDir, "src", "comments.ts"),
    "// Add more validation if needed\nexport const commentExample = true;\n",
  );
  return rootDir;
}

function withRuleConfig(
  ruleId: string,
  config: { enabled?: boolean; weight?: number },
): AnalyzerConfig {
  return {
    ...DEFAULT_CONFIG,
    rules: {
      ...DEFAULT_CONFIG.rules,
      [ruleId]: config,
    },
  };
}

describe("rule config support", () => {
  test("can disable a rule via config", async () => {
    const rootDir = await createTempRepo();
    const result = await analyzeRepository(
      rootDir,
      withRuleConfig("comments.placeholder-comments", { enabled: false }),
      createDefaultRegistry(),
    );

    expect(result.findings).toHaveLength(0);
  });

  test("can weight a rule via config", async () => {
    const rootDir = await createTempRepo();
    const baseline = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());
    const weighted = await analyzeRepository(
      rootDir,
      withRuleConfig("comments.placeholder-comments", { weight: 2 }),
      createDefaultRegistry(),
    );

    expect(baseline.findings).toHaveLength(1);
    expect(weighted.findings).toHaveLength(1);
    expect(weighted.findings[0]?.score).toBeCloseTo((baseline.findings[0]?.score ?? 0) * 2, 6);
  });

  test("loadConfig reads slop-scan.config.json", async () => {
    const rootDir = await createTempRepo();
    await writeFile(
      path.join(rootDir, "slop-scan.config.json"),
      JSON.stringify({ ignores: ["src/comments.ts"] }),
    );

    const config = await loadConfig(rootDir);

    expect(config.ignores).toEqual(["src/comments.ts"]);
  });

  test("loadConfig falls back to repo-slop.config.json", async () => {
    const rootDir = await createTempRepo();
    await writeFile(
      path.join(rootDir, "repo-slop.config.json"),
      JSON.stringify({ ignores: ["src/comments.ts"] }),
    );

    const config = await loadConfig(rootDir);

    expect(config.ignores).toEqual(["src/comments.ts"]);
  });
});
