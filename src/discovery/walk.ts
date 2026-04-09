import { statSync } from "node:fs";
import { globby } from "globby";
import { access, stat } from "node:fs/promises";
import path from "node:path";
import type { AnalyzerConfig } from "../config";
import type { DirectoryRecord, FileRecord, LanguagePlugin } from "../core/types";

interface CachedDiscoveryFile {
  path: string;
  absolutePath: string;
  extension: string;
  languageId: string;
}

interface CachedDiscoveryDirectory {
  path: string;
  filePaths: string[];
}

interface CachedDiscoveryResult {
  directories: CachedDiscoveryDirectory[];
  directoryMtimesNs: Array<{ path: string; mtimeNs: bigint }>;
  files: CachedDiscoveryFile[];
  gitignoreMtimeNs: bigint | null;
}

const discoveryCache = new Map<string, CachedDiscoveryResult>();

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

/** Builds the cache key for a discovery run. */
function discoveryCacheKey(
  rootDir: string,
  config: AnalyzerConfig,
  languages: LanguagePlugin[],
): string {
  return [
    rootDir,
    config.ignores.join("\0"),
    languages.map((language) => language.id).join("\0"),
  ].join("\u0001");
}

/** Reads an optional path mtime without throwing for misses. */
async function statMtimeNs(targetPath: string): Promise<bigint | null> {
  return stat(targetPath, { bigint: true }).then(
    (stats) => stats.mtimeNs,
    () => null,
  );
}

/** Reads an optional path mtime on the cache-hit fast path. */
function statMtimeNsSync(targetPath: string): bigint | null {
  return statSync(targetPath, { bigint: true, throwIfNoEntry: false })?.mtimeNs ?? null;
}

/** Checks whether discovery needs to consult a root .gitignore. */
async function hasRootGitignore(rootDir: string): Promise<boolean> {
  return access(path.join(rootDir, ".gitignore")).then(
    () => true,
    () => false,
  );
}

/** Checks whether cached discovery results are still valid. */
async function canReuseDiscoveryCache(
  rootDir: string,
  cached: CachedDiscoveryResult,
): Promise<boolean> {
  if (cached.gitignoreMtimeNs !== null) {
    const currentGitignoreMtimeNs = await statMtimeNs(path.join(rootDir, ".gitignore"));
    if (currentGitignoreMtimeNs !== cached.gitignoreMtimeNs) {
      return false;
    }
  }

  return cached.directoryMtimesNs.every(
    (directory) => statMtimeNsSync(path.join(rootDir, directory.path)) === directory.mtimeNs,
  );
}

/** Returns fresh discovery records from cached data. */
function cloneDiscovery(cached: CachedDiscoveryResult): {
  files: FileRecord[];
  directories: DirectoryRecord[];
} {
  return {
    files: cached.files.map((file) => ({
      path: file.path,
      absolutePath: file.absolutePath,
      extension: file.extension,
      lineCount: 0,
      logicalLineCount: 0,
      languageId: file.languageId,
    })),
    directories: cached.directories.map((directory) => ({
      path: directory.path,
      filePaths: [...directory.filePaths],
    })),
  };
}

/** Finds analyzable files and reuses cached results when possible. */
export async function discoverSourceFiles(
  rootDir: string,
  config: AnalyzerConfig,
  languages: LanguagePlugin[],
): Promise<{ files: FileRecord[]; directories: DirectoryRecord[] }> {
  const cacheKey = discoveryCacheKey(rootDir, config, languages);
  const cached = discoveryCache.get(cacheKey);
  if (cached && (await canReuseDiscoveryCache(rootDir, cached))) {
    return cloneDiscovery(cached);
  }

  const ignoreFiles = (await hasRootGitignore(rootDir)) ? ".gitignore" : undefined;
  const matchedPaths = await globby(["**/*"], {
    cwd: rootDir,
    onlyFiles: true,
    dot: true,
    followSymbolicLinks: false,
    ignore: config.ignores,
    ignoreFiles,
  });

  const files: FileRecord[] = [];
  for (const matchedPath of matchedPaths.sort((left, right) => left.localeCompare(right))) {
    const relativePath = normalizePath(matchedPath);
    const language = languages.find((plugin) => plugin.supports(relativePath));
    if (!language) {
      continue;
    }

    files.push({
      path: relativePath,
      absolutePath: path.join(rootDir, relativePath),
      extension: path.extname(relativePath),
      lineCount: 0,
      logicalLineCount: 0,
      languageId: language.id,
    });
  }

  const directoryMap = new Map<string, string[]>();
  for (const file of files) {
    const directoryPath = normalizePath(path.dirname(file.path));
    const list = directoryMap.get(directoryPath) ?? [];
    list.push(file.path);
    directoryMap.set(directoryPath, list);
  }

  const directories = [...directoryMap.entries()]
    .map(([directoryPath, filePaths]) => ({ path: directoryPath, filePaths: filePaths.sort() }))
    .sort((left, right) => left.path.localeCompare(right.path));

  const trackedDirectoryPaths = new Set<string>([
    ".",
    ...directories.map((directory) => directory.path),
  ]);
  const directoryMtimesNs = [...trackedDirectoryPaths]
    .sort((left, right) => left.localeCompare(right))
    .map((directoryPath) => ({
      path: directoryPath,
      mtimeNs: statSync(path.join(rootDir, directoryPath), { bigint: true }).mtimeNs,
    }));

  discoveryCache.set(cacheKey, {
    files: files.map((file) => ({
      path: file.path,
      absolutePath: file.absolutePath,
      extension: file.extension,
      languageId: file.languageId ?? "unknown",
    })),
    directories: directories.map((directory) => ({
      path: directory.path,
      filePaths: [...directory.filePaths],
    })),
    directoryMtimesNs,
    gitignoreMtimeNs: await statMtimeNs(path.join(rootDir, ".gitignore")),
  });

  return {
    files,
    directories,
  };
}
