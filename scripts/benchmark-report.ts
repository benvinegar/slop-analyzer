import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getOption } from "./lib/get-option";
import {
  DEFAULT_BENCHMARK_SET_PATH,
  loadBenchmarkSet,
  resolveProjectPath,
} from "../src/benchmarks/manifest";
import { renderBenchmarkReport } from "../src/benchmarks/report";
import type { BenchmarkSnapshot } from "../src/benchmarks/types";

const manifestPath = getOption(process.argv.slice(2), "--manifest", DEFAULT_BENCHMARK_SET_PATH);
const benchmarkSet = await loadBenchmarkSet(manifestPath);
const snapshotPath = resolveProjectPath(benchmarkSet.artifacts.snapshotPath);
const reportPath = resolveProjectPath(benchmarkSet.artifacts.reportPath);
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8")) as BenchmarkSnapshot;
const report = renderBenchmarkReport(benchmarkSet, snapshot);

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${report}\n`);

console.log(`Wrote benchmark report to ${reportPath}`);
