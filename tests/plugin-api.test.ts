import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadConfigFile } from "../src/config";
import { createDefaultRegistry } from "../src/default-registry";
import { analyzeRepository } from "../src/core/engine";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTempRepo(files: Record<string, string>): Promise<string> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "slop-scan-plugin-"));
  tempDirs.push(rootDir);

  for (const [relativePath, content] of Object.entries(files)) {
    await mkdir(path.join(rootDir, path.dirname(relativePath)), { recursive: true });
    await writeFile(path.join(rootDir, relativePath), content);
  }

  return rootDir;
}

async function analyzeWithConfiguredPlugins(rootDir: string) {
  const loaded = await loadConfigFile(rootDir);
  const registry = createDefaultRegistry();

  for (const plugin of loaded.plugins) {
    registry.registerPlugin(plugin.namespace, plugin.plugin);
  }

  const result = await analyzeRepository(rootDir, loaded.config, registry);
  return { loaded, registry, result };
}

describe("plugin api", () => {
  test("loads a local plugin from slop-scan.config.ts and passes rule options", async () => {
    const rootDir = await createTempRepo({
      "src/index.ts": 'export const note = "danger zone";\n',
      "plugins/local-word-plugin.mjs": [
        "export default {",
        '  meta: { name: "local-word-plugin", namespace: "local", apiVersion: 1 },',
        "  rules: {",
        '    "contains-word": {',
        '      id: "local/contains-word",',
        '      family: "local",',
        '      severity: "weak",',
        '      scope: "file",',
        '      requires: ["file.text"],',
        "      supports(context) {",
        '        return context.scope === "file" && Boolean(context.file);',
        "      },",
        "      evaluate(context) {",
        '        const text = context.runtime.store.getFileFact(context.file.path, "file.text") ?? "";',
        "        const options = context.ruleConfig?.options ?? {};",
        '        const word = typeof options.word === "string" ? options.word : "danger";',
        "        if (!text.includes(word)) {",
        "          return [];",
        "        }",
        "",
        "        return [{",
        '          ruleId: "local/contains-word",',
        '          family: "local",',
        '          severity: "weak",',
        '          scope: "file",',
        "          path: context.file.path,",
        "          message: `Found ${word} in file text`,",
        "          evidence: [word],",
        "          score: 1,",
        "          locations: [{ path: context.file.path, line: 1 }],",
        "        }];",
        "      },",
        "    },",
        "  },",
        "};",
      ].join("\n"),
      "slop-scan.config.ts": [
        'import plugin from "./plugins/local-word-plugin.mjs";',
        "",
        "export default {",
        "  plugins: { local: plugin },",
        "  rules: {",
        '    "local/contains-word": { enabled: true, options: { word: "danger" } },',
        "  },",
        "};",
      ].join("\n"),
    });

    const { loaded, result } = await analyzeWithConfiguredPlugins(rootDir);

    expect(loaded.format).toBe("module");
    expect(loaded.plugins.map((plugin) => plugin.namespace)).toEqual(["local"]);
    expect(loaded.config.rules["local/contains-word"]?.options).toEqual({ word: "danger" });
    expect(result.findings.map((finding) => finding.ruleId)).toContain("local/contains-word");
    expect(result.findings[0]?.evidence).toEqual(["danger"]);
  });

  test("loads a package plugin and resolves plugin presets from extends", async () => {
    const rootDir = await createTempRepo({
      "src/index.ts": 'export const note = "needle in a haystack";\n',
      "node_modules/slop-scan-plugin-package/package.json": JSON.stringify(
        {
          name: "slop-scan-plugin-package",
          type: "module",
          exports: "./index.mjs",
        },
        null,
        2,
      ),
      "node_modules/slop-scan-plugin-package/index.mjs": [
        "export default {",
        '  meta: { name: "slop-scan-plugin-package", namespace: "pkg", apiVersion: 1 },',
        "  rules: {",
        '    "contains-word": {',
        '      id: "pkg/contains-word",',
        '      family: "pkg",',
        '      severity: "weak",',
        '      scope: "file",',
        '      requires: ["file.text"],',
        "      supports(context) {",
        '        return context.scope === "file" && Boolean(context.file);',
        "      },",
        "      evaluate(context) {",
        '        const text = context.runtime.store.getFileFact(context.file.path, "file.text") ?? "";',
        "        const options = context.ruleConfig?.options ?? {};",
        '        const word = typeof options.word === "string" ? options.word : "needle";',
        "        if (!text.includes(word)) {",
        "          return [];",
        "        }",
        "",
        "        return [{",
        '          ruleId: "pkg/contains-word",',
        '          family: "pkg",',
        '          severity: "weak",',
        '          scope: "file",',
        "          path: context.file.path,",
        "          message: `Found ${word} in file text`,",
        "          evidence: [word],",
        "          score: 1,",
        "          locations: [{ path: context.file.path, line: 1 }],",
        "        }];",
        "      },",
        "    },",
        "  },",
        "  configs: {",
        '    recommended: { rules: { "pkg/contains-word": { enabled: true, weight: 2, options: { word: "needle" } } } },',
        "  },",
        "};",
      ].join("\n"),
      "slop-scan.config.json": JSON.stringify(
        {
          plugins: { pkg: "slop-scan-plugin-package" },
          extends: ["plugin:pkg/recommended"],
        },
        null,
        2,
      ),
    });

    const { loaded, result } = await analyzeWithConfiguredPlugins(rootDir);

    expect(loaded.format).toBe("json");
    expect(loaded.config.rules["pkg/contains-word"]).toEqual({
      enabled: true,
      weight: 2,
      options: { word: "needle" },
    });
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.ruleId).toBe("pkg/contains-word");
    expect(result.findings[0]?.score).toBe(2);
  });

  test("rejects plugin namespace mismatches", async () => {
    const rootDir = await createTempRepo({
      "plugins/mismatch.mjs": [
        "export default {",
        '  meta: { name: "mismatch-plugin", namespace: "other", apiVersion: 1 },',
        "};",
      ].join("\n"),
      "slop-scan.config.json": JSON.stringify(
        {
          plugins: { local: "./plugins/mismatch.mjs" },
        },
        null,
        2,
      ),
    });

    await expect(loadConfigFile(rootDir)).rejects.toThrow('declares namespace "other"');
  });

  test("rejects plugin rules whose ids do not match the namespace", async () => {
    const rootDir = await createTempRepo({
      "plugins/invalid-rule.mjs": [
        "export default {",
        '  meta: { name: "invalid-rule-plugin", namespace: "local", apiVersion: 1 },',
        "  rules: {",
        '    "contains-word": {',
        '      id: "local/not-the-right-id",',
        '      family: "local",',
        '      severity: "weak",',
        '      scope: "file",',
        "      requires: [],",
        "      supports() { return true; },",
        "      evaluate() { return []; },",
        "    },",
        "  },",
        "};",
      ].join("\n"),
      "slop-scan.config.json": JSON.stringify(
        {
          plugins: { local: "./plugins/invalid-rule.mjs" },
        },
        null,
        2,
      ),
    });

    await expect(loadConfigFile(rootDir)).rejects.toThrow(
      'rule "contains-word" must use id "local/contains-word"',
    );
  });

  test("registry rejects duplicate plugin rule ids", () => {
    const registry = createDefaultRegistry();
    const plugin = {
      meta: { name: "duplicate-plugin", namespace: "local", apiVersion: 1 as const },
      rules: {
        "contains-word": {
          id: "local/contains-word",
          family: "local",
          severity: "weak" as const,
          scope: "file" as const,
          requires: [],
          supports() {
            return true;
          },
          evaluate() {
            return [];
          },
        },
      },
    };

    registry.registerPlugin("local", plugin);

    expect(() => registry.registerPlugin("local", plugin)).toThrow(
      "Duplicate rule id: local/contains-word",
    );
  });
});
