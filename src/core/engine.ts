import type { AnalyzerConfig } from "../config";
import { discoverSourceFiles } from "../discovery/walk";
import { FactStore } from "./fact-store";
import { orderFactProviders, validateRuleRequirements } from "./scheduler";
import type {
  AnalysisResult,
  AnalysisSummary,
  AnalyzerRuntime,
  DirectoryRecord,
  FactProvider,
  FileRecord,
  Finding,
  ProviderContext,
  RulePlugin,
} from "./types";
import { Registry } from "./registry";
import { countLogicalLines } from "../facts/ts-helpers";
import type { FunctionSummary } from "../facts/types";

function createRuntime(
  rootDir: string,
  config: AnalyzerConfig,
  files: FileRecord[],
  directories: DirectoryRecord[],
  store: FactStore,
): AnalyzerRuntime {
  return { rootDir, config, files, directories, store };
}

async function runProviders(
  providers: FactProvider[],
  contexts: ProviderContext[],
  store: FactStore,
): Promise<void> {
  for (const context of contexts) {
    for (const provider of providers) {
      if (!provider.supports(context)) {
        continue;
      }

      const producedFacts = await provider.run(context);
      for (const [factId, value] of Object.entries(producedFacts)) {
        if (context.scope === "file" && context.file) {
          store.setFileFact(context.file.path, factId, value);
        } else if (context.scope === "directory" && context.directory) {
          store.setDirectoryFact(context.directory.path, factId, value);
        } else if (context.scope === "repo") {
          store.setRepoFact(factId, value);
        }
      }
    }
  }
}

async function runRules(rules: RulePlugin[], contexts: ProviderContext[]): Promise<Finding[]> {
  const findings: Finding[] = [];

  for (const context of contexts) {
    for (const rule of rules) {
      const ruleConfig = context.runtime.config.rules[rule.id];
      if (ruleConfig?.enabled === false || !rule.supports(context)) {
        continue;
      }

      const weight = ruleConfig?.weight ?? 1;
      const nextFindings = await rule.evaluate(context);
      findings.push(
        ...nextFindings.map((finding) => ({
          ...finding,
          score: finding.score * weight,
        })),
      );
    }
  }

  return findings;
}

function buildFileScores(files: FileRecord[], findings: Finding[]) {
  return files
    .map((file) => {
      const fileFindings = findings.filter((finding) => finding.path === file.path);
      const score = fileFindings.reduce((total, finding) => total + finding.score, 0);
      return { path: file.path, score, findingCount: fileFindings.length };
    })
    .filter((score) => score.findingCount > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
}

function buildDirectoryScores(directories: DirectoryRecord[], findings: Finding[]) {
  return directories
    .map((directory) => {
      const directoryFindings = findings.filter(
        (finding) => finding.scope === "directory" && finding.path === directory.path,
      );
      const score = directoryFindings.reduce((total, finding) => total + finding.score, 0);
      return { path: directory.path, score, findingCount: directoryFindings.length };
    })
    .filter((score) => score.findingCount > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
}

function divideOrNull(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function buildSummary(files: FileRecord[], directories: DirectoryRecord[], findings: Finding[], store: FactStore): AnalysisSummary {
  const repoScore = findings.reduce((total, finding) => total + finding.score, 0);
  const physicalLineCount = files.reduce((total, file) => total + file.lineCount, 0);
  const logicalLineCount = files.reduce((total, file) => total + countLogicalLines(file.text, file.path), 0);
  const functionCount = files.reduce(
    (total, file) => total + (store.getFileFact<FunctionSummary[]>(file.path, "file.functionSummaries")?.length ?? 0),
    0,
  );
  const kloc = logicalLineCount / 1000;

  return {
    fileCount: files.length,
    directoryCount: directories.length,
    findingCount: findings.length,
    repoScore,
    physicalLineCount,
    logicalLineCount,
    functionCount,
    normalized: {
      scorePerFile: divideOrNull(repoScore, files.length),
      scorePerKloc: divideOrNull(repoScore, kloc),
      scorePerFunction: divideOrNull(repoScore, functionCount),
      findingsPerFile: divideOrNull(findings.length, files.length),
      findingsPerKloc: divideOrNull(findings.length, kloc),
      findingsPerFunction: divideOrNull(findings.length, functionCount),
    },
  };
}

export async function analyzeRepository(
  rootDir: string,
  config: AnalyzerConfig,
  registry: Registry,
): Promise<AnalysisResult> {
  const discovery = await discoverSourceFiles(rootDir, config, registry.getLanguages());
  const store = new FactStore();
  const runtime = createRuntime(rootDir, config, discovery.files, discovery.directories, store);

  for (const file of discovery.files) {
    store.setFileFact(file.path, "file.record", file);
    store.setFileFact(file.path, "file.text", file.text);
    store.setFileFact(file.path, "file.lineCount", file.lineCount);
  }

  for (const directory of discovery.directories) {
    store.setDirectoryFact(directory.path, "directory.record", directory);
  }

  store.setRepoFact("repo.files", discovery.files);
  store.setRepoFact("repo.directories", discovery.directories);

  const fileProviders = registry.getFactProviders().filter((provider) => provider.scope === "file");
  const directoryProviders = registry.getFactProviders().filter((provider) => provider.scope === "directory");
  const repoProviders = registry.getFactProviders().filter((provider) => provider.scope === "repo");

  const fileBaseFacts = ["file.record", "file.text", "file.lineCount"];
  const orderedFileProviders = orderFactProviders(fileProviders, fileBaseFacts);
  const fileDerivedFacts = orderedFileProviders.flatMap((provider) => provider.provides);

  const orderedDirectoryProviders = orderFactProviders(directoryProviders, [
    "directory.record",
    ...fileBaseFacts,
    ...fileDerivedFacts,
  ]);
  const directoryDerivedFacts = orderedDirectoryProviders.flatMap((provider) => provider.provides);

  const orderedRepoProviders = orderFactProviders(repoProviders, [
    "repo.files",
    "repo.directories",
    "directory.record",
    ...fileBaseFacts,
    ...fileDerivedFacts,
    ...directoryDerivedFacts,
  ]);

  await runProviders(
    orderedFileProviders,
    discovery.files.map((file) => ({ scope: "file", file, runtime })),
    store,
  );
  await runProviders(
    orderedDirectoryProviders,
    discovery.directories.map((directory) => ({ scope: "directory", directory, runtime })),
    store,
  );
  await runProviders(orderedRepoProviders, [{ scope: "repo", runtime }], store);

  const availableFacts = [
    ...fileBaseFacts,
    ...fileDerivedFacts,
    "directory.record",
    ...directoryDerivedFacts,
    "repo.files",
    "repo.directories",
    ...orderedRepoProviders.flatMap((provider) => provider.provides),
  ];

  validateRuleRequirements(
    registry.getRules().map((rule) => ({ id: rule.id, requires: rule.requires })),
    availableFacts,
  );

  const fileFindings = await runRules(
    registry.getRules().filter((rule) => rule.scope === "file"),
    discovery.files.map((file) => ({ scope: "file", file, runtime })),
  );
  const directoryFindings = await runRules(
    registry.getRules().filter((rule) => rule.scope === "directory"),
    discovery.directories.map((directory) => ({ scope: "directory", directory, runtime })),
  );
  const repoFindings = await runRules(
    registry.getRules().filter((rule) => rule.scope === "repo"),
    [{ scope: "repo", runtime }],
  );

  const findings = [...fileFindings, ...directoryFindings, ...repoFindings];
  const fileScores = buildFileScores(discovery.files, findings);
  const directoryScores = buildDirectoryScores(discovery.directories, findings);
  const summary = buildSummary(discovery.files, discovery.directories, findings, store);

  return {
    rootDir,
    config,
    summary,
    files: discovery.files,
    directories: discovery.directories,
    findings,
    fileScores,
    directoryScores,
    repoScore: summary.repoScore,
  };
}
