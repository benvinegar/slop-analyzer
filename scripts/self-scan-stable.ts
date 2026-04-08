import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

interface Summary {
  fileCount: number;
  directoryCount: number;
  findingCount: number;
  repoScore: number;
  physicalLineCount: number;
  logicalLineCount: number;
  functionCount: number;
  normalized: {
    scorePerFile: number | null;
    scorePerKloc: number | null;
    scorePerFunction: number | null;
    findingsPerFile: number | null;
    findingsPerKloc: number | null;
    findingsPerFunction: number | null;
  };
}

interface BaselineSnapshot {
  scannerVersion: string;
  summary: Summary;
  ruleCounts: Record<string, number>;
}

interface ScanReport {
  summary: Summary;
  findings: Array<{ ruleId: string }>;
}

const BASELINE_PATH = path.resolve("tests/fixtures/self-scan-stable-baseline.json");
const STABLE_PACKAGE_PATH = path.resolve("node_modules/slop-scan-stable/package.json");
const STABLE_BIN_PATH = path.resolve("node_modules/slop-scan-stable/bin/slop-scan.js");
const UPDATE_FLAG = "--update";
const SCORE_EPSILON = 1e-9;

function countRuleHits(report: ScanReport): Record<string, number> {
  const counts = new Map<string, number>();

  for (const finding of report.findings) {
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    ),
  );
}

async function readStableVersion(): Promise<string> {
  const raw = await readFile(STABLE_PACKAGE_PATH, "utf8");
  const parsed = JSON.parse(raw) as { version: string };
  return parsed.version;
}

function runStableScan(): ScanReport {
  const result = spawnSync("node", [STABLE_BIN_PATH, "scan", ".", "--json"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  if (result.status !== 0) {
    if (result.stdout.length > 0) {
      console.log(result.stdout.trimEnd());
    }
    if (result.stderr.length > 0) {
      console.error(result.stderr.trimEnd());
    }

    throw new Error(`stable self-scan failed with exit code ${result.status ?? 1}`);
  }

  return JSON.parse(result.stdout) as ScanReport;
}

async function readBaseline(): Promise<BaselineSnapshot> {
  const raw = await readFile(BASELINE_PATH, "utf8");
  return JSON.parse(raw) as BaselineSnapshot;
}

async function writeBaseline(snapshot: BaselineSnapshot): Promise<void> {
  await writeFile(BASELINE_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
}

function printSummary(scannerVersion: string, summary: Summary, baseline?: BaselineSnapshot): void {
  console.log(`stable self-scan (slop-scan ${scannerVersion})`);
  console.log(`- files scanned: ${summary.fileCount}`);
  console.log(
    `- findings: ${summary.findingCount}${baseline ? ` (baseline ${baseline.summary.findingCount})` : ""}`,
  );
  console.log(
    `- repo score: ${summary.repoScore.toFixed(2)}${baseline ? ` (baseline ${baseline.summary.repoScore.toFixed(2)})` : ""}`,
  );
}

const shouldUpdate = process.argv.includes(UPDATE_FLAG);
const scannerVersion = await readStableVersion();
const report = runStableScan();
const ruleCounts = countRuleHits(report);

if (shouldUpdate) {
  await writeBaseline({
    scannerVersion,
    summary: report.summary,
    ruleCounts,
  });

  printSummary(scannerVersion, report.summary);
  console.log(`updated ${path.relative(process.cwd(), BASELINE_PATH)}`);
  process.exit(0);
}

const baseline = await readBaseline();
printSummary(scannerVersion, report.summary, baseline);

const errors: string[] = [];
if (report.summary.findingCount > baseline.summary.findingCount) {
  errors.push(
    `finding count regressed: ${report.summary.findingCount} > ${baseline.summary.findingCount}`,
  );
}
if (report.summary.repoScore > baseline.summary.repoScore + SCORE_EPSILON) {
  errors.push(
    `repo score regressed: ${report.summary.repoScore.toFixed(6)} > ${baseline.summary.repoScore.toFixed(6)}`,
  );
}

if (errors.length > 0) {
  console.error("stable self-scan regression detected:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error(`- baseline file: ${path.relative(process.cwd(), BASELINE_PATH)}`);
  process.exit(1);
}
