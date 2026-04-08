import { spawnSync } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import packageJson from "../package.json";
import { getOption } from "./lib/get-option";
import {
  DEFAULT_BENCHMARK_SET_PATH,
  loadBenchmarkSet,
  resolveProjectPath,
} from "../src/benchmarks/manifest";
import { createBenchmarkSnapshot } from "../src/benchmarks/snapshot";
import { DEFAULT_CONFIG } from "../src/config";
import { analyzeRepository } from "../src/core/engine";
import { createDefaultRegistry } from "../src/default-registry";

async function assertExists(targetPath: string, message: string): Promise<void> {
  try {
    await access(targetPath);
  } catch {
    throw new Error(message);
  }
}

function readHeadRef(checkoutPath: string): string {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: checkoutPath,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`Unable to read HEAD for ${checkoutPath}: ${result.stderr}`);
  }

  return result.stdout.trim();
}

const manifestPath = getOption(process.argv.slice(2), "--manifest", DEFAULT_BENCHMARK_SET_PATH);
const benchmarkSet = await loadBenchmarkSet(manifestPath);
const checkoutsDir = resolveProjectPath(benchmarkSet.artifacts.checkoutsDir);
const snapshotPath = resolveProjectPath(benchmarkSet.artifacts.snapshotPath);
const registry = createDefaultRegistry();
const analyses = [];

for (const repo of benchmarkSet.repos) {
  const checkoutPath = path.join(checkoutsDir, repo.id);
  await assertExists(
    checkoutPath,
    `Missing checkout for ${repo.id} at ${checkoutPath}. Run bun run benchmark:fetch first.`,
  );

  const actualRef = readHeadRef(checkoutPath);
  if (actualRef !== repo.ref) {
    throw new Error(`Pinned ref mismatch for ${repo.id}: expected ${repo.ref}, got ${actualRef}`);
  }

  console.log(`scanning ${repo.id} @ ${actualRef.slice(0, 7)}`);
  const result = await analyzeRepository(checkoutPath, DEFAULT_CONFIG, registry);
  analyses.push({ spec: repo, result });
}

const snapshot = createBenchmarkSnapshot(benchmarkSet, analyses, packageJson.version);
await mkdir(path.dirname(snapshotPath), { recursive: true });
await writeFile(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);

console.log(`\nWrote benchmark snapshot to ${snapshotPath}`);
