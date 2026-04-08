import type { Finding, NormalizedMetrics } from "../core/types";
import type {
  BenchmarkCohort,
  BenchmarkCohortSnapshot,
  BenchmarkPairSnapshot,
  BenchmarkRepoSnapshot,
  BenchmarkSnapshot,
  BenchmarkSet,
  BenchmarkedAnalysis,
} from "./types";
import { NORMALIZED_METRIC_KEYS } from "./types";

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle] ?? null;
  }

  const left = sorted[middle - 1];
  const right = sorted[middle];
  return left !== undefined && right !== undefined ? (left + right) / 2 : null;
}

function divideOrNull(numerator: number | null, denominator: number | null): number | null {
  return numerator !== null && denominator !== null && denominator !== 0
    ? numerator / denominator
    : null;
}

function summarizeRuleCounts(findings: Finding[]): Record<string, number> {
  const counts = new Map<string, number>();

  for (const finding of findings) {
    counts.set(finding.ruleId, (counts.get(finding.ruleId) ?? 0) + 1);
  }

  return Object.fromEntries(
    [...counts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    ),
  );
}

function buildRepoSnapshot({ spec, result }: BenchmarkedAnalysis): BenchmarkRepoSnapshot {
  return {
    id: spec.id,
    repo: spec.repo,
    cohort: spec.cohort,
    ref: spec.ref,
    summary: result.summary,
    blendedScore: null,
    ruleCounts: summarizeRuleCounts(result.findings),
    topFiles: result.fileScores.slice(0, 5),
    topDirectories: result.directoryScores.slice(0, 5),
  };
}

function buildMedianMetrics(repos: BenchmarkRepoSnapshot[]): NormalizedMetrics {
  const entries = NORMALIZED_METRIC_KEYS.map((metricKey) => {
    const values = repos
      .map((repo) => repo.summary.normalized[metricKey])
      .filter((value): value is number => value !== null);
    return [metricKey, median(values)];
  });

  return Object.fromEntries(entries) as NormalizedMetrics;
}

function geometricMean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  if (values.some((value) => value === 0)) {
    return 0;
  }

  return Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
}

function computeRawBlendedScore(
  metrics: NormalizedMetrics,
  matureMedian: NormalizedMetrics,
): number | null {
  const ratios = NORMALIZED_METRIC_KEYS.flatMap((metricKey) => {
    const value = metrics[metricKey];
    const baseline = matureMedian[metricKey];

    if (value === null || baseline === null || baseline <= 0) {
      return [];
    }

    return [value / baseline];
  });

  return geometricMean(ratios);
}

function buildCohortSnapshots(
  repos: BenchmarkRepoSnapshot[],
): Record<BenchmarkCohort, BenchmarkCohortSnapshot> {
  const cohorts: Record<BenchmarkCohort, BenchmarkRepoSnapshot[]> = {
    "explicit-ai": [],
    "mature-oss": [],
  };

  for (const repo of repos) {
    cohorts[repo.cohort].push(repo);
  }

  const buildSnapshot = (cohortRepos: BenchmarkRepoSnapshot[]): BenchmarkCohortSnapshot => ({
    repoCount: cohortRepos.length,
    medians: buildMedianMetrics(cohortRepos),
    blendedScoreMedian: median(
      cohortRepos
        .map((repo) => repo.blendedScore)
        .filter((value): value is number => value !== null),
    ),
  });

  return {
    "explicit-ai": buildSnapshot(cohorts["explicit-ai"]),
    "mature-oss": buildSnapshot(cohorts["mature-oss"]),
  };
}

function applyBlendedScores(
  repos: BenchmarkRepoSnapshot[],
  matureMedian: NormalizedMetrics,
): BenchmarkRepoSnapshot[] {
  const rawScores = repos.map((repo) => ({
    repo,
    rawBlendedScore: computeRawBlendedScore(repo.summary.normalized, matureMedian),
  }));

  const matureBaseline = median(
    rawScores
      .filter(({ repo }) => repo.cohort === "mature-oss")
      .map(({ rawBlendedScore }) => rawBlendedScore)
      .filter((value): value is number => value !== null),
  );

  return rawScores.map(({ repo, rawBlendedScore }) => ({
    ...repo,
    blendedScore:
      rawBlendedScore !== null && matureBaseline !== null && matureBaseline > 0
        ? rawBlendedScore / matureBaseline
        : rawBlendedScore,
  }));
}

function buildPairings(set: BenchmarkSet, repos: BenchmarkRepoSnapshot[]): BenchmarkPairSnapshot[] {
  return set.pairings.map((pairing) => {
    const aiRepo = repos.find((repo) => repo.id === pairing.aiRepoId);
    const solidRepo = repos.find((repo) => repo.id === pairing.solidRepoId);

    if (!aiRepo || !solidRepo) {
      throw new Error(
        `Unable to resolve benchmark pairing ${pairing.aiRepoId} -> ${pairing.solidRepoId}`,
      );
    }

    const ratios = Object.fromEntries(
      NORMALIZED_METRIC_KEYS.map((metricKey) => [
        metricKey,
        divideOrNull(aiRepo.summary.normalized[metricKey], solidRepo.summary.normalized[metricKey]),
      ]),
    ) as NormalizedMetrics;

    return {
      aiRepoId: pairing.aiRepoId,
      solidRepoId: pairing.solidRepoId,
      notes: pairing.notes,
      ratios,
    };
  });
}

export function createBenchmarkSnapshot(
  set: BenchmarkSet,
  analyses: BenchmarkedAnalysis[],
  analyzerVersion: string,
  generatedAt = new Date().toISOString(),
): BenchmarkSnapshot {
  const baseRepos = analyses.map(buildRepoSnapshot);
  const initialCohorts = buildCohortSnapshots(baseRepos);
  const repos = applyBlendedScores(baseRepos, initialCohorts["mature-oss"].medians);

  return {
    schemaVersion: 1,
    benchmarkSetId: set.id,
    benchmarkSetName: set.name,
    generatedAt,
    analyzerVersion,
    configMode: "default",
    repos,
    cohorts: buildCohortSnapshots(repos),
    pairings: buildPairings(set, repos),
  };
}
