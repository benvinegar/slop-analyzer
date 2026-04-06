import type { AnalyzerConfig } from "../config";

export type Scope = "file" | "directory" | "repo";

export interface FileRecord {
  path: string;
  absolutePath: string;
  extension: string;
  text: string;
  lineCount: number;
  languageId: string | null;
}

export interface DirectoryRecord {
  path: string;
  filePaths: string[];
}

export interface FindingLocation {
  path: string;
  line: number;
  column?: number;
}

export interface Finding {
  ruleId: string;
  family: string;
  severity: "strong" | "medium" | "weak";
  scope: Scope;
  message: string;
  evidence: string[];
  score: number;
  locations: FindingLocation[];
  path?: string;
}

export interface FileScore {
  path: string;
  score: number;
  findingCount: number;
}

export interface DirectoryScore {
  path: string;
  score: number;
  findingCount: number;
}

export interface NormalizedMetrics {
  scorePerFile: number | null;
  scorePerKloc: number | null;
  scorePerFunction: number | null;
  findingsPerFile: number | null;
  findingsPerKloc: number | null;
  findingsPerFunction: number | null;
}

export interface AnalysisSummary {
  fileCount: number;
  directoryCount: number;
  findingCount: number;
  repoScore: number;
  physicalLineCount: number;
  logicalLineCount: number;
  functionCount: number;
  normalized: NormalizedMetrics;
}

export interface AnalysisResult {
  rootDir: string;
  config: AnalyzerConfig;
  summary: AnalysisSummary;
  files: FileRecord[];
  directories: DirectoryRecord[];
  findings: Finding[];
  fileScores: FileScore[];
  directoryScores: DirectoryScore[];
  repoScore: number;
}

export interface LanguagePlugin {
  id: string;
  supports(filePath: string): boolean;
}

export interface ProviderBase {
  id: string;
  scope: Scope;
  requires: string[];
  supports(context: ProviderContext): boolean;
}

export interface FactProvider extends ProviderBase {
  provides: string[];
  run(context: ProviderContext): Promise<Record<string, unknown>> | Record<string, unknown>;
}

export interface RulePlugin extends ProviderBase {
  family: string;
  severity: "strong" | "medium" | "weak";
  evaluate(context: ProviderContext): Promise<Finding[]> | Finding[];
}

export interface ReporterPlugin {
  id: string;
  render(result: AnalysisResult): Promise<string> | string;
}

export interface AnalyzerRuntime {
  rootDir: string;
  config: AnalyzerConfig;
  files: FileRecord[];
  directories: DirectoryRecord[];
  store: FactStoreReader;
}

export interface ProviderContext {
  scope: Scope;
  runtime: AnalyzerRuntime;
  file?: FileRecord;
  directory?: DirectoryRecord;
}

export interface FactStoreReader {
  getRepoFact<T>(factId: string): T | undefined;
  getDirectoryFact<T>(directoryPath: string, factId: string): T | undefined;
  getFileFact<T>(filePath: string, factId: string): T | undefined;
  hasRepoFact(factId: string): boolean;
  hasDirectoryFact(directoryPath: string, factId: string): boolean;
  hasFileFact(filePath: string, factId: string): boolean;
}
