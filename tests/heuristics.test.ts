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
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "slop-scan-heuristics-"));
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

  test("downweights boundary-oriented try/catch and ignores try/finally", async () => {
    const rootDir = await createTempRepo({
      "src/io.ts": [
        'import * as fs from "node:fs";',
        "",
        "export function loadConfig(filePath: string) {",
        "  try {",
        '    return JSON.parse(fs.readFileSync(filePath, "utf8"));',
        "  } catch (error) {",
        "    return null;",
        "  }",
        "}",
        "",
        "export function cleanup(lockPath: string) {",
        "  try {",
        "    fs.unlinkSync(lockPath);",
        "  } finally {",
        "    fs.existsSync(lockPath);",
        "  }",
        "}",
        "",
      ].join("\n"),
      "src/leaf.ts": [
        "function transform(input: string) {",
        "  return input.trim();",
        "}",
        "",
        "export function safeTransform(input: string) {",
        "  try {",
        "    return transform(input);",
        "  } catch (error) {",
        "    return null;",
        "  }",
        "}",
        "",
      ].join("\n"),
    });

    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());
    const ioFinding = result.findings.find(
      (finding) =>
        finding.path === "src/io.ts" && finding.ruleId === "defensive.needless-try-catch",
    );
    const leafFinding = result.findings.find(
      (finding) =>
        finding.path === "src/leaf.ts" && finding.ruleId === "defensive.needless-try-catch",
    );

    expect(ioFinding).toBeDefined();
    expect(leafFinding).toBeDefined();
    expect(ioFinding?.score ?? 0).toBeLessThan(leafFinding?.score ?? 0);
    expect(ioFinding?.evidence.some((entry) => entry.includes("boundary=config|filesystem"))).toBe(
      true,
    );
    expect(ioFinding?.locations).toHaveLength(1);
  });

  test("does not flag routine phrasing or alias compatibility wrappers", async () => {
    const rootDir = await createTempRepo({
      "src/comments.ts": [
        "/** Wrap code for page.evaluate(), using async IIFE with block or expression body as needed. */",
        "export const wrapped = true;",
        "",
      ].join("\n"),
      "src/aliases.ts": [
        "function describeToolCall(input: string) {",
        "  return input;",
        "}",
        "",
        "// Keep the old name as an alias for backward compat",
        "export function summarizeToolInput(input: string) {",
        "  return describeToolCall(input);",
        "}",
        "",
      ].join("\n"),
    });

    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());

    expect(result.findings).toHaveLength(0);
  });

  test("flags duplicated mock setup across test files", async () => {
    const rootDir = await createTempRepo({
      "src/api.ts": ["export async function fetchUser() {", "  return { id: 1 };", "}", ""].join(
        "\n",
      ),
      "tests/user-a.test.ts": [
        "import { describe, expect, it, vi } from 'vitest';",
        "import * as api from '../src/api';",
        "",
        "vi.mock('../src/api', () => ({",
        "  fetchUser: vi.fn(),",
        "}));",
        "",
        "describe('user a', () => {",
        "  it('loads user', () => {",
        "    vi.mocked(api.fetchUser).mockResolvedValue({ id: 1 });",
        "    expect(true).toBe(true);",
        "  });",
        "});",
        "",
      ].join("\n"),
      "tests/user-b.test.ts": [
        "import { describe, expect, it, vi } from 'vitest';",
        "import * as api from '../src/api';",
        "",
        "vi.mock('../src/api', () => ({",
        "  fetchUser: vi.fn(),",
        "}));",
        "",
        "describe('user b', () => {",
        "  it('loads user again', () => {",
        "    vi.mocked(api.fetchUser).mockResolvedValue({ id: 2 });",
        "    expect(true).toBe(true);",
        "  });",
        "});",
        "",
      ].join("\n"),
      "tests/user-c.test.ts": [
        "import { describe, expect, it, vi } from 'vitest';",
        "import * as api from '../src/api';",
        "",
        "vi.mock('../src/api', () => ({",
        "  fetchUser: vi.fn(),",
        "}));",
        "",
        "describe('user c', () => {",
        "  it('loads user one more time', () => {",
        "    vi.mocked(api.fetchUser).mockResolvedValue({ id: 3 });",
        "    expect(true).toBe(true);",
        "  });",
        "});",
        "",
      ].join("\n"),
      "tests/cli.spec.ts": [
        "import { expect, it } from 'vitest';",
        "",
        "const run = (value: string) => value.toUpperCase();",
        "",
        "it('uppercases strings', () => {",
        "  expect(run('ok')).toBe('OK');",
        "});",
        "",
      ].join("\n"),
    });

    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());
    const duplicateFindings = result.findings.filter(
      (finding) => finding.ruleId === "tests.duplicate-mock-setup",
    );

    expect(duplicateFindings).toHaveLength(3);
    expect(duplicateFindings.every((finding) => finding.path?.startsWith("tests/user-"))).toBe(
      true,
    );
    expect(
      duplicateFindings[0]?.evidence.some((entry) => entry.includes("mockResolvedValue")),
    ).toBe(true);
    expect(
      duplicateFindings[0]?.locations.some((location) => location.path === "tests/user-a.test.ts"),
    ).toBe(true);
    expect(
      duplicateFindings[0]?.locations.some((location) => location.path === "tests/user-b.test.ts"),
    ).toBe(true);
    expect(
      duplicateFindings[0]?.locations.some((location) => location.path === "tests/user-c.test.ts"),
    ).toBe(true);
  });

  test("does not treat test matrices or svg/icon packs as structural slop", async () => {
    const rootDir = await createTempRepo({
      "test/na/npm.test.ts": "export const value = 1;\n",
      "test/na/pnpm.test.ts": "export const value = 2;\n",
      "test/na/bun.test.ts": "export const value = 3;\n",
      "test/na/yarn.test.ts": "export const value = 4;\n",
      "test/na/deno.test.ts": "export const value = 5;\n",
      "test/na/cnpm.test.ts": "export const value = 6;\n",
      "src/components/svg/Add.tsx": "export default function Add() { return null; }\n",
      "src/components/svg/Edit.tsx": "export default function Edit() { return null; }\n",
      "src/components/svg/Delete.tsx": "export default function Delete() { return null; }\n",
      "src/components/svg/Copy.tsx": "export default function Copy() { return null; }\n",
      "src/components/svg/Paste.tsx": "export default function Paste() { return null; }\n",
      "src/components/svg/Save.tsx": "export default function Save() { return null; }\n",
      "src/components/svg/index.ts": [
        "export { default as Add } from './Add';",
        "export { default as Edit } from './Edit';",
        "export { default as Delete } from './Delete';",
        "export { default as Copy } from './Copy';",
        "export { default as Paste } from './Paste';",
        "export { default as Save } from './Save';",
        "",
      ].join("\n"),
    });

    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());
    const directoryFindings = result.findings.filter((finding) => finding.scope === "directory");

    expect(directoryFindings.some((finding) => finding.path === "test/na")).toBe(false);
    expect(directoryFindings.some((finding) => finding.path === "src/components/svg")).toBe(false);
  });

  test("does not treat contract-driven async helpers as async noise", async () => {
    const rootDir = await createTempRepo({
      "src/permissions/user.ts": [
        "type Auth = { user: { id: string; isAdmin: boolean } };",
        "",
        "export async function canCreateUser({ user }: Auth) {",
        "  return user.isAdmin;",
        "}",
        "",
        "export async function canViewUser({ user }: Auth, viewedUserId: string) {",
        "  if (user.isAdmin) {",
        "    return true;",
        "  }",
        "",
        "  return user.id === viewedUserId;",
        "}",
        "",
      ].join("\n"),
      "src/queries/prisma/user.ts": [
        "const prisma = {",
        "  client: {",
        "    user: {",
        "      findUnique(criteria: unknown) {",
        "        return criteria;",
        "      },",
        "    },",
        "  },",
        "};",
        "",
        "export async function findUser(criteria: unknown) {",
        "  return prisma.client.user.findUnique(criteria);",
        "}",
        "",
      ].join("\n"),
    });

    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());

    expect(result.findings.some((finding) => finding.ruleId === "defensive.async-noise")).toBe(
      false,
    );
    expect(
      result.findings.some((finding) => finding.ruleId === "structure.pass-through-wrappers"),
    ).toBe(false);
  });

  test("flags duplicated helper signatures across source files", async () => {
    const rootDir = await createTempRepo({
      "src/users/normalize.ts": [
        "export function normalizeUserId(input: string) {",
        "  const trimmed = input.trim().toLowerCase();",
        "  if (!trimmed.startsWith('usr_')) {",
        "    return `usr_${trimmed}`;",
        "  }",
        "",
        "  return trimmed;",
        "}",
        "",
      ].join("\n"),
      "src/teams/normalize.ts": [
        "export function normalizeTeamId(value: string) {",
        "  const cleaned = value.trim().toLowerCase();",
        "  if (!cleaned.startsWith('team_')) {",
        "    return `team_${cleaned}`;",
        "  }",
        "",
        "  return cleaned;",
        "}",
        "",
      ].join("\n"),
      "src/accounts/normalize.ts": [
        "export function normalizeAccountId(raw: string) {",
        "  const normalized = raw.trim().toLowerCase();",
        "  if (!normalized.startsWith('acct_')) {",
        "    return `acct_${normalized}`;",
        "  }",
        "",
        "  return normalized;",
        "}",
        "",
      ].join("\n"),
      "tests/helpers.test.ts": [
        "function normalizeTestId(input: string) {",
        "  const trimmed = input.trim().toLowerCase();",
        "  if (!trimmed.startsWith('test_')) {",
        "    return `test_${trimmed}`;",
        "  }",
        "",
        "  return trimmed;",
        "}",
        "",
        "export { normalizeTestId };",
        "",
      ].join("\n"),
    });

    const result = await analyzeRepository(rootDir, DEFAULT_CONFIG, createDefaultRegistry());
    const duplicateFindings = result.findings.filter(
      (finding) => finding.ruleId === "structure.duplicate-function-signatures",
    );

    expect(duplicateFindings).toHaveLength(3);
    expect(duplicateFindings.every((finding) => finding.path?.startsWith("src/"))).toBe(true);
    expect(
      duplicateFindings[0]?.evidence.some((entry) => entry.includes("repeated in 3 files")),
    ).toBe(true);
    expect(
      duplicateFindings[0]?.locations.some(
        (location) => location.path === "src/users/normalize.ts",
      ),
    ).toBe(true);
    expect(
      duplicateFindings[0]?.locations.some(
        (location) => location.path === "src/teams/normalize.ts",
      ),
    ).toBe(true);
    expect(
      duplicateFindings[0]?.locations.some(
        (location) => location.path === "src/accounts/normalize.ts",
      ),
    ).toBe(true);
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
