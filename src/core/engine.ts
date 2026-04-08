import { readFileSync } from "node:fs";
import type { AnalyzerConfig } from "../config";
import { discoverSourceFiles } from "../discovery/walk";
import { countLogicalLines, countPhysicalLines } from "../facts/ts-helpers";
import type { FunctionSummary } from "../facts/types";
import { FactStore } from "./fact-store";
import { Registry } from "./registry";
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

export interface AnalyzeRepositoryHooks {
  onFileAnalyzed?(file: FileRecord, store: FactStore): void;
  onFileReleased?(file: FileRecord, store: FactStore): void;
}

export interface AnalyzeRepositoryOptions {
  hooks?: AnalyzeRepositoryHooks;
}

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
  const byFile = new Map<string, { score: number; findingCount: number }>();

  for (const finding of findings) {
    if (!finding.path) {
      continue;
    }

    const next = byFile.get(finding.path) ?? { score: 0, findingCount: 0 };
    next.score += finding.score;
    next.findingCount += 1;
    byFile.set(finding.path, next);
  }

  return files
    .map((file) => {
      const aggregate = byFile.get(file.path);
      return {
        path: file.path,
        score: aggregate?.score ?? 0,
        findingCount: aggregate?.findingCount ?? 0,
      };
    })
    .filter((score) => score.findingCount > 0)
    .sort((left, right) => right.score - left.score || left.path.localeCompare(right.path));
}

function buildDirectoryScores(directories: DirectoryRecord[], findings: Finding[]) {
  const byDirectory = new Map<string, { score: number; findingCount: number }>();

  for (const finding of findings) {
    if (finding.scope !== "directory" || !finding.path) {
      continue;
    }

    const next = byDirectory.get(finding.path) ?? { score: 0, findingCount: 0 };
    next.score += finding.score;
    next.findingCount += 1;
    byDirectory.set(finding.path, next);
  }

  return directories
    .map((directory) => {
      const aggregate = byDirectory.get(directory.path);
      return {
        path: directory.path,
        score: aggregate?.score ?? 0,
        findingCount: aggregate?.findingCount ?? 0,
      };
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
  const logicalLineCount = files.reduce((total, file) => total + file.logicalLineCount, 0);
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

function requiredFileFacts(items: Array<{ requires: string[] }>): Set<string> {
  const facts = new Set<string>();

  for (const item of items) {
    for (const factId of item.requires) {
      if (factId.startsWith("file.")) {
        facts.add(factId);
      }
    }
  }

  return facts;
}

export async function analyzeRepository(
  rootDir: string,
  config: AnalyzerConfig,
  registry: Registry,
  options: AnalyzeRepositoryOptions = {},
): Promise<AnalysisResult> {
  const discovery = await discoverSourceFiles(rootDir, config, registry.getLanguages());
  const store = new FactStore();
  const runtime = createRuntime(rootDir, config, discovery.files, discovery.directories, store);

  const fileProviders = registry.getFactProviders().filter((provider) => provider.scope === "file");
  const directoryProviders = registry.getFactProviders().filter((provider) => provider.scope === "directory");
  const repoProviders = registry.getFactProviders().filter((provider) => provider.scope === "repo");
  const fileRules = registry.getRules().filter((rule) => rule.scope === "file");
  const directoryRules = registry.getRules().filter((rule) => rule.scope === "directory");
  const repoRules = registry.getRules().filter((rule) => rule.scope === "repo");

  const fileBaseFacts = ["file.record", "file.text", "file.lineCount", "file.logicalLineCount"];
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

  const immediateFileRules = fileRules.filter((rule) => rule.requires.every((factId) => factId.startsWith("file.")));
  const delayedFileRules = fileRules.filter((rule) => !immediateFileRules.includes(rule));

  const durableFileFacts = new Set<string>(["file.lineCount", "file.logicalLineCount"]);
  for (const factId of requiredFileFacts([
    ...orderedDirectoryProviders,
    ...orderedRepoProviders,
    ...delayedFileRules,
    ...directoryRules,
    ...repoRules,
  ])) {
    durableFileFacts.add(factId);
  }

  store.setRepoFact("repo.files", discovery.files);
  store.setRepoFact("repo.directories", discovery.directories);

  for (const directory of discovery.directories) {
    store.setDirectoryFact(directory.path, "directory.record", directory);
  }

  const findings: Finding[] = [];

  for (const file of discovery.files) {
    const text = readFileSync(file.absolutePath, "utf8");
    file.lineCount = countPhysicalLines(text);
    file.logicalLineCount = countLogicalLines(text, file.path);

    store.setFileFact(file.path, "file.record", file);
    store.setFileFact(file.path, "file.text", text);
    store.setFileFact(file.path, "file.lineCount", file.lineCount);
    store.setFileFact(file.path, "file.logicalLineCount", file.logicalLineCount);

    const context = { scope: "file", file, runtime } satisfies ProviderContext;
    await runProviders(orderedFileProviders, [context], store);
    findings.push(...(await runRules(immediateFileRules, [context])));
    options.hooks?.onFileAnalyzed?.(file, store);

    store.retainFileFacts(file.path, durableFileFacts);
    options.hooks?.onFileReleased?.(file, store);
  }

  await runProviders(
    orderedDirectoryProviders,
    discovery.directories.map((directory) => ({ scope: "directory", directory, runtime })),
    store,
  );
  await runProviders(orderedRepoProviders, [{ scope: "repo", runtime }], store);

  findings.push(
    ...(await runRules(
      delayedFileRules,
      discovery.files.map((file) => ({ scope: "file", file, runtime })),
    )),
  );
  findings.push(
    ...(await runRules(
      directoryRules,
      discovery.directories.map((directory) => ({ scope: "directory", directory, runtime })),
    )),
  );
  findings.push(...(await runRules(repoRules, [{ scope: "repo", runtime }])));

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
