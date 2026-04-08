import { describe, expect, test } from "bun:test";
import path from "node:path";
import { DEFAULT_CONFIG, loadConfig } from "../src/config";
import { formatHelp, run } from "../src/cli";

describe("project scaffold", () => {
  test("help text mentions scan command", () => {
    expect(formatHelp()).toContain("slop-scan");
    expect(formatHelp()).toContain("scan");
    expect(formatHelp()).toContain("--lint");
    expect(formatHelp()).toContain("pluggable registry");
  });

  test("loadConfig returns defaults when config file is absent", async () => {
    const fixtureRoot = path.join(process.cwd(), "tests", "fixtures", "repos", "clean");
    const config = await loadConfig(fixtureRoot);
    expect(config).toEqual(DEFAULT_CONFIG);
  });

  test("scan command exits successfully", async () => {
    const fixtureRoot = path.join(process.cwd(), "tests", "fixtures", "repos", "clean");
    const exitCode = await run(["scan", fixtureRoot]);
    expect(exitCode).toBe(0);
  });
});
