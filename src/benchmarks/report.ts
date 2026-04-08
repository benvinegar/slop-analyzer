import type {
  BenchmarkCohort,
  BenchmarkRepoSnapshot,
  BenchmarkSet,
  BenchmarkSnapshot,
} from "./types";
import { NORMALIZED_METRIC_KEYS } from "./types";

function formatMetric(value: number | null, digits = 2): string {
  return value === null ? "n/a" : value.toFixed(digits);
}

function formatRatio(value: number | null): string {
  return value === null ? "n/a" : `${value.toFixed(2)}x`;
}

function shortRef(ref: string): string {
  return ref.slice(0, 7);
}

function yearsBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return (end - start) / (365.25 * 24 * 60 * 60 * 1000);
}

function aggregateRuleCounts(repos: BenchmarkRepoSnapshot[]): Array<[string, number, number]> {
  const counts = new Map<string, number>();

  for (const repo of repos) {
    for (const [ruleId, count] of Object.entries(repo.ruleCounts)) {
      counts.set(ruleId, (counts.get(ruleId) ?? 0) + count);
    }
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([ruleId, count]) => [ruleId, count, total === 0 ? 0 : count / total]);
}

function renderRepoLink(repo: BenchmarkRepoSnapshot): string {
  return `[${repo.repo}](https://github.com/${repo.repo})`;
}

function sortByBlendedScore(repos: BenchmarkRepoSnapshot[]): BenchmarkRepoSnapshot[] {
  return [...repos].sort((left, right) => {
    const leftScore = left.blendedScore ?? Number.NEGATIVE_INFINITY;
    const rightScore = right.blendedScore ?? Number.NEGATIVE_INFINITY;
    return rightScore - leftScore || left.repo.localeCompare(right.repo);
  });
}

function renderRepoTable(
  set: BenchmarkSet,
  snapshot: BenchmarkSnapshot,
  cohort: BenchmarkCohort,
): string[] {
  const repos = sortByBlendedScore(snapshot.repos.filter((repo) => repo.cohort === cohort));

  const lines = [
    "| Repo | Ref | Age | Stars | Blended | Files | Logical LOC | Functions | Score/file | Score/KLOC | Score/function | Findings/file | Findings/KLOC | Findings/function |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
  ];

  for (const repo of repos) {
    const spec = set.repos.find((entry) => entry.id === repo.id);
    if (!spec) {
      continue;
    }

    const ageYears = yearsBetween(spec.createdAt, snapshot.generatedAt);
    lines.push(
      `| ${renderRepoLink(repo)} | \`${shortRef(repo.ref)}\` | ${ageYears.toFixed(1)}y | ${spec.stars} | **${formatMetric(repo.blendedScore)}** | ${repo.summary.fileCount} | ${repo.summary.logicalLineCount} | ${repo.summary.functionCount} | ${formatMetric(repo.summary.normalized.scorePerFile)} | ${formatMetric(repo.summary.normalized.scorePerKloc)} | ${formatMetric(repo.summary.normalized.scorePerFunction)} | ${formatMetric(repo.summary.normalized.findingsPerFile)} | ${formatMetric(repo.summary.normalized.findingsPerKloc)} | ${formatMetric(repo.summary.normalized.findingsPerFunction)} |`,
    );
  }

  return lines;
}

function renderCohortRuleSummary(repos: BenchmarkRepoSnapshot[]): string[] {
  return aggregateRuleCounts(repos)
    .slice(0, 6)
    .map(
      ([ruleId, count, fraction]) => `- \`${ruleId}\` — ${count} (${(fraction * 100).toFixed(1)}%)`,
    );
}

export function renderBenchmarkReport(set: BenchmarkSet, snapshot: BenchmarkSnapshot): string {
  const aiRepos = snapshot.repos.filter((repo) => repo.cohort === "explicit-ai");
  const solidRepos = snapshot.repos.filter((repo) => repo.cohort === "mature-oss");
  const aiCohort = snapshot.cohorts["explicit-ai"];
  const solidCohort = snapshot.cohorts["mature-oss"];
  const aiMedian = aiCohort.medians;
  const solidMedian = solidCohort.medians;
  const blendedMedianRatio =
    aiCohort.blendedScoreMedian !== null &&
    solidCohort.blendedScoreMedian !== null &&
    solidCohort.blendedScoreMedian !== 0
      ? aiCohort.blendedScoreMedian / solidCohort.blendedScoreMedian
      : null;
  const medianRatios = Object.fromEntries(
    NORMALIZED_METRIC_KEYS.map((metricKey) => [
      metricKey,
      aiMedian[metricKey] !== null &&
      solidMedian[metricKey] !== null &&
      solidMedian[metricKey] !== 0
        ? aiMedian[metricKey] / solidMedian[metricKey]
        : null,
    ]),
  ) as typeof aiMedian;

  const lines = [
    `# Pinned benchmark: ${set.name}`,
    "",
    `Date: ${snapshot.generatedAt.slice(0, 10)}`,
    `Analyzer version: ${snapshot.analyzerVersion}`,
    `Config mode: ${snapshot.configMode}`,
    "",
    "## Goal",
    "",
    set.description,
    "",
    "## Reproduction",
    "",
    "```bash",
    "bun run benchmark:fetch",
    "bun run benchmark:scan",
    "bun run benchmark:report",
    "```",
    "",
    `Manifest: \`benchmarks/sets/${set.id}.json\``,
    `Snapshot: \`${set.artifacts.snapshotPath}\``,
    `Report: \`${set.artifacts.reportPath}\``,
    "",
    "The pinned refs below are the exact commits used for the saved snapshot.",
    "",
    "Blended score = geometric mean of the six normalized-metric ratios versus the mature OSS cohort medians, then rescaled so the mature OSS cohort median is 1.00. Higher means a repo is consistently noisier across the benchmark dimensions.",
    "",
    "## AI cohort",
    "",
    ...renderRepoTable(set, snapshot, "explicit-ai"),
    "",
    "## Mature OSS cohort",
    "",
    ...renderRepoTable(set, snapshot, "mature-oss"),
    "",
    "## Cohort medians",
    "",
    "| Metric | AI median | Solid median | Ratio |",
    "|---|---:|---:|---:|",
    `| Blended score | **${formatMetric(aiCohort.blendedScoreMedian)}** | **${formatMetric(solidCohort.blendedScoreMedian)}** | **${formatRatio(blendedMedianRatio)}** |`,
    `| Score / file | **${formatMetric(aiMedian.scorePerFile)}** | **${formatMetric(solidMedian.scorePerFile)}** | **${formatRatio(medianRatios.scorePerFile)}** |`,
    `| Score / KLOC | **${formatMetric(aiMedian.scorePerKloc)}** | **${formatMetric(solidMedian.scorePerKloc)}** | **${formatRatio(medianRatios.scorePerKloc)}** |`,
    `| Score / function | **${formatMetric(aiMedian.scorePerFunction)}** | **${formatMetric(solidMedian.scorePerFunction)}** | **${formatRatio(medianRatios.scorePerFunction)}** |`,
    `| Findings / file | **${formatMetric(aiMedian.findingsPerFile)}** | **${formatMetric(solidMedian.findingsPerFile)}** | **${formatRatio(medianRatios.findingsPerFile)}** |`,
    `| Findings / KLOC | **${formatMetric(aiMedian.findingsPerKloc)}** | **${formatMetric(solidMedian.findingsPerKloc)}** | **${formatRatio(medianRatios.findingsPerKloc)}** |`,
    `| Findings / function | **${formatMetric(aiMedian.findingsPerFunction)}** | **${formatMetric(solidMedian.findingsPerFunction)}** | **${formatRatio(medianRatios.findingsPerFunction)}** |`,
    "",
    "## Spot-check pairings",
    "",
    "| AI repo | Solid repo | Score/file ratio | Score/KLOC ratio | Score/function ratio | Findings/file ratio | Findings/KLOC ratio | Findings/function ratio |",
    "|---|---|---:|---:|---:|---:|---:|---:|",
    ...snapshot.pairings.map(
      (pairing) =>
        `| \`${pairing.aiRepoId}\` | \`${pairing.solidRepoId}\` | ${formatRatio(pairing.ratios.scorePerFile)} | ${formatRatio(pairing.ratios.scorePerKloc)} | ${formatRatio(pairing.ratios.scorePerFunction)} | ${formatRatio(pairing.ratios.findingsPerFile)} | ${formatRatio(pairing.ratios.findingsPerKloc)} | ${formatRatio(pairing.ratios.findingsPerFunction)} |`,
    ),
    "",
    "## Top rule families by cohort",
    "",
    "### AI cohort",
    ...renderCohortRuleSummary(aiRepos),
    "",
    "### Mature OSS cohort",
    ...renderCohortRuleSummary(solidRepos),
    "",
    "## Notes",
    "",
    "- This benchmark is intentionally pinned to exact commit SHAs so future reruns can reproduce the same cohort.",
    "- AI provenance in the set may come from README disclosures or user-provided provenance recorded in the manifest.",
    "- The benchmark scanner uses the analyzer's default config for every repo to keep results comparable.",
    "- The analyzer still only scans JS/TS-family files, so non-JS/TS portions of mixed-language repos are out of scope.",
  ];

  return lines.join("\n");
}
