import type {
  AnalysisResult,
  AnalysisSummary,
  DirectoryScore,
  FileScore,
  NormalizedMetrics,
} from "../core/types";

export type BenchmarkCohort = "explicit-ai" | "mature-oss";

export interface BenchmarkArtifacts {
  checkoutsDir: string;
  snapshotPath: string;
  reportPath: string;
}

export interface BenchmarkRepoSpec {
  id: string;
  repo: string;
  url: string;
  cohort: BenchmarkCohort;
  ref: string;
  createdAt: string;
  stars: number;
  provenance: string;
  notes?: string;
}

export interface BenchmarkPairing {
  aiRepoId: string;
  solidRepoId: string;
  notes?: string;
}

export interface BenchmarkSet {
  schemaVersion: 1;
  id: string;
  name: string;
  description: string;
  artifacts: BenchmarkArtifacts;
  repos: BenchmarkRepoSpec[];
  pairings: BenchmarkPairing[];
}

export interface BenchmarkRepoSnapshot {
  id: string;
  repo: string;
  cohort: BenchmarkCohort;
  ref: string;
  summary: AnalysisSummary;
  blendedScore: number | null;
  ruleCounts: Record<string, number>;
  topFiles: FileScore[];
  topDirectories: DirectoryScore[];
}

export interface BenchmarkCohortSnapshot {
  repoCount: number;
  medians: NormalizedMetrics;
  blendedScoreMedian: number | null;
}

export interface BenchmarkPairSnapshot {
  aiRepoId: string;
  solidRepoId: string;
  notes?: string;
  ratios: NormalizedMetrics;
}

export interface BenchmarkSnapshot {
  schemaVersion: 1;
  benchmarkSetId: string;
  benchmarkSetName: string;
  generatedAt: string;
  analyzerVersion: string;
  configMode: "default";
  repos: BenchmarkRepoSnapshot[];
  cohorts: Record<BenchmarkCohort, BenchmarkCohortSnapshot>;
  pairings: BenchmarkPairSnapshot[];
}

export interface BenchmarkedAnalysis {
  spec: BenchmarkRepoSpec;
  result: AnalysisResult;
}

export const NORMALIZED_METRIC_KEYS: Array<keyof NormalizedMetrics> = [
  "scorePerFile",
  "scorePerKloc",
  "scorePerFunction",
  "findingsPerFile",
  "findingsPerKloc",
  "findingsPerFunction",
];
