import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { analyzeRepository } from "../src/core/engine";
import { DEFAULT_CONFIG } from "../src/config";
import { createDefaultRegistry } from "../src/default-registry";
import { discoverSourceFiles } from "../src/discovery/walk";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTempRepo(files?: Record<string, string>): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "slop-scan-"));
  tempDirs.push(rootDir);

  if (files) {
    for (const [relativePath, content] of Object.entries(files)) {
      await mkdir(path.join(rootDir, path.dirname(relativePath)), { recursive: true });
      await writeFile(path.join(rootDir, relativePath), content);
    }
    return rootDir;
  }

  await mkdir(path.join(rootDir, "src"), { recursive: true });
  await mkdir(path.join(rootDir, "dist"), { recursive: true });
  await mkdir(path.join(rootDir, ".next"), { recursive: true });
  await writeFile(path.join(rootDir, "src", "index.ts"), "export const value = 1;\n");
  await writeFile(path.join(rootDir, "dist", "ignored.ts"), "export const ignored = true;\n");
  await writeFile(path.join(rootDir, ".next", "ignored.ts"), "export const built = true;\n");
  await writeFile(path.join(rootDir, "README.md"), "ignored by language detection\n");
  return rootDir;
}

describe("analysis engine", () => {
  test("discovers supported files and ignores configured paths", async () => {
    const rootDir = await createTempRepo();
    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());

    expect(result.files.map((file) => file.path)).toEqual(["src/index.ts"]);
    expect(result.directories.map((directory) => directory.path)).toEqual(["src"]);
    expect(result.findings).toHaveLength(0);
    expect(result.repoScore).toBe(0);
  });

  test("discovers supported files in hidden directories when not ignored", async () => {
    const rootDir = await createTempRepo({
      ".storybook/main.ts": "export default {};\n",
      "src/index.ts": "export const value = 1;\n",
    });

    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());

    expect(result.files.map((file) => file.path)).toEqual([".storybook/main.ts", "src/index.ts"]);
  });

  test("respects root .gitignore entries", async () => {
    const rootDir = await createTempRepo({
      ".gitignore": ["ignored/*", "!ignored/keep.ts"].join("\n"),
      "src/index.ts": "export const value = 1;\n",
      "ignored/drop.ts": "export const ignored = true;\n",
      "ignored/keep.ts": "export const kept = true;\n",
    });

    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());

    expect(result.files.map((file) => file.path)).toEqual(["ignored/keep.ts", "src/index.ts"]);
  });

  test("renders text and json reports via the registry", async () => {
    const rootDir = await createTempRepo();
    const registry = createDefaultRegistry();
    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, registry);

    const text = await registry.getReporter("text").render(result);
    const json = await registry.getReporter("json").render(result);

    expect(text).toContain("files scanned: 1");
    expect(json).toContain('"files"');
    expect(json).toContain('"src/index.ts"');
  });

  test("analyzes files lazily and keeps transient file facts scoped to the current file", async () => {
    const rootDir = await createTempRepo({
      "src/a.ts": "export const a = 1;\n",
      "src/b.ts": "export const b = 2;\n",
      "src/c.ts": "export const c = 3;\n",
    });
    const registry = createDefaultRegistry();
    const discovery = await discoverSourceFiles(rootDir, DEFAULT_CONFIG, registry.getLanguages());

    expect(discovery.files.map((file) => file.path)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);
    for (const file of discovery.files) {
      expect(Object.keys(file)).not.toContain("text");
      expect(file.lineCount).toBe(0);
      expect(file.logicalLineCount).toBe(0);
    }

    const snapshots: Array<{ file: string; textPaths: string[]; astPaths: string[] }> = [];
    await analyzeRepository(rootDir, DEFAULT_CONFIG, registry, {
      hooks: {
        onFileAnalyzed(file, store) {
          snapshots.push({
            file: file.path,
            textPaths: store.listFilePathsWithFact("file.text"),
            astPaths: store.listFilePathsWithFact("file.ast"),
          });
        },
      },
    });

    expect(snapshots).toHaveLength(3);
    for (const snapshot of snapshots) {
      expect(snapshot.textPaths).toEqual([snapshot.file]);
      expect(snapshot.astPaths).toEqual([snapshot.file]);
    }
  });

  test("releases heavy per-file facts after each file is processed", async () => {
    const rootDir = await createTempRepo({
      "src/a.ts":
        "// placeholder comment\nexport async function a(run: () => Promise<number>) {\n  try {\n    return await run();\n  } catch {\n    return 0;\n  }\n}\n",
      "src/b.ts": "export const b = 2;\n",
      "src/c.ts": "export const c = 3;\n",
    });
    const registry = createDefaultRegistry();

    const released: Array<{
      file: string;
      textPaths: string[];
      astPaths: string[];
      commentPaths: string[];
      tryCatchPaths: string[];
      functionSummaryPaths: string[];
      exportSummaryPaths: string[];
    }> = [];

    await analyzeRepository(rootDir, DEFAULT_CONFIG, registry, {
      hooks: {
        onFileReleased(file, store) {
          released.push({
            file: file.path,
            textPaths: store.listFilePathsWithFact("file.text"),
            astPaths: store.listFilePathsWithFact("file.ast"),
            commentPaths: store.listFilePathsWithFact("file.comments"),
            tryCatchPaths: store.listFilePathsWithFact("file.tryCatchSummaries"),
            functionSummaryPaths: store.listFilePathsWithFact("file.functionSummaries"),
            exportSummaryPaths: store.listFilePathsWithFact("file.exportSummary"),
          });
        },
      },
    });

    expect(released).toEqual([
      {
        file: "src/a.ts",
        textPaths: [],
        astPaths: [],
        commentPaths: [],
        tryCatchPaths: [],
        functionSummaryPaths: ["src/a.ts"],
        exportSummaryPaths: ["src/a.ts"],
      },
      {
        file: "src/b.ts",
        textPaths: [],
        astPaths: [],
        commentPaths: [],
        tryCatchPaths: [],
        functionSummaryPaths: ["src/a.ts", "src/b.ts"],
        exportSummaryPaths: ["src/a.ts", "src/b.ts"],
      },
      {
        file: "src/c.ts",
        textPaths: [],
        astPaths: [],
        commentPaths: [],
        tryCatchPaths: [],
        functionSummaryPaths: ["src/a.ts", "src/b.ts", "src/c.ts"],
        exportSummaryPaths: ["src/a.ts", "src/b.ts", "src/c.ts"],
      },
    ]);
  });
});
