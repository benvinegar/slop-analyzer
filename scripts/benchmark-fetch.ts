import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  DEFAULT_BENCHMARK_SET_PATH,
  loadBenchmarkSet,
  resolveProjectPath,
} from "../src/benchmarks/manifest";

function getOption(argv: string[], flag: string, fallback: string): string {
  const index = argv.indexOf(flag);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
}

function run(command: string, args: string[], cwd?: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      [`Command failed: ${command} ${args.join(" ")}`, result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result.stdout.trim();
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

const manifestPath = getOption(process.argv.slice(2), "--manifest", DEFAULT_BENCHMARK_SET_PATH);
const benchmarkSet = await loadBenchmarkSet(manifestPath);
const checkoutsDir = resolveProjectPath(benchmarkSet.artifacts.checkoutsDir);

await mkdir(checkoutsDir, { recursive: true });

for (const repo of benchmarkSet.repos) {
  const checkoutPath = path.join(checkoutsDir, repo.id);
  const gitPath = path.join(checkoutPath, ".git");

  console.log(`\n==> ${repo.id} (${repo.repo})`);

  if (!(await pathExists(gitPath))) {
    console.log(`cloning ${repo.url}`);
    run("git", ["clone", "--filter=blob:none", "--no-checkout", repo.url, checkoutPath]);
  }

  run("git", ["remote", "set-url", "origin", repo.url], checkoutPath);
  run("git", ["fetch", "--force", "--prune", "--filter=blob:none", "origin"], checkoutPath);
  run("git", ["checkout", "--force", "--detach", repo.ref], checkoutPath);
  run("git", ["reset", "--hard", repo.ref], checkoutPath);
  run("git", ["clean", "-fdx"], checkoutPath);

  const actualRef = run("git", ["rev-parse", "HEAD"], checkoutPath);
  if (actualRef !== repo.ref) {
    throw new Error(`Pinned ref mismatch for ${repo.id}: expected ${repo.ref}, got ${actualRef}`);
  }

  console.log(`ready at ${actualRef.slice(0, 7)}`);
}

console.log(`\nPinned benchmark checkouts are ready in ${checkoutsDir}`);
