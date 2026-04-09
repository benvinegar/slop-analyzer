import type { RulePlugin } from "../core/types";
import { isTestFile } from "../facts/ts-helpers";
import type { DirectoryMetrics } from "../facts/types";
import { countMatching, isAssetLikeDirectoryPath, ratio } from "./helpers";

/**
 * Flags directories dominated by tiny files and structural ceremony.
 *
 * This is meant to catch "split everything into microscopic wrappers/chunks"
 * behavior, not disciplined modularity. That is why the rule backs off for test
 * suites, asset directories, and directories whose small files still carry real
 * implementation weight.
 */
export const overFragmentationRule: RulePlugin = {
  id: "structure.over-fragmentation",
  family: "structure",
  severity: "strong",
  scope: "directory",
  requires: ["directory.metrics"],
  supports(context) {
    return context.scope === "directory" && Boolean(context.directory);
  },
  evaluate(context) {
    const metrics =
      context.runtime.store.getDirectoryFact<DirectoryMetrics>(
        context.directory!.path,
        "directory.metrics",
      ) ?? null;

    if (!metrics || context.directory!.path === ".") {
      return [];
    }

    const tinyRatio = ratio(metrics.tinyFileCount, metrics.fileCount);
    // "Ceremony" means files that mostly exist to forward/re-export rather than
    // introduce distinct behavior.
    const ceremonyRatio = ratio(
      metrics.wrapperFileCount + metrics.barrelFileCount,
      metrics.fileCount,
    );
    const testFileRatio = ratio(
      countMatching(context.directory!.filePaths, (filePath) => isTestFile(filePath)),
      metrics.fileCount,
    );
    const averageFileLines = ratio(metrics.totalLineCount, metrics.fileCount);
    const isAssetDirectory = isAssetLikeDirectoryPath(context.directory!.path);

    if (metrics.fileCount < 6 || tinyRatio < 0.6) {
      return [];
    }

    if (testFileRatio >= 0.8) {
      return [];
    }

    // Icon packs and similar assets are expected to be many tiny files.
    if (isAssetDirectory && tinyRatio >= 0.75) {
      return [];
    }

    // If the directory is small-file-heavy but not ceremony-heavy, and the
    // average file still has some substance, it is more likely legitimate
    // modular code than fragmentation for its own sake.
    if (ceremonyRatio < 0.2 && averageFileLines > 20) {
      return [];
    }

    return [
      {
        ruleId: "structure.over-fragmentation",
        family: "structure",
        severity: "strong",
        scope: "directory",
        path: context.directory!.path,
        message: `Directory looks over-fragmented (${metrics.fileCount} files, ${metrics.tinyFileCount} tiny files)`,
        evidence: [
          `tinyRatio=${tinyRatio.toFixed(2)}`,
          `ceremonyRatio=${ceremonyRatio.toFixed(2)}`,
          `testFileRatio=${testFileRatio.toFixed(2)}`,
          `averageFileLines=${averageFileLines.toFixed(1)}`,
          `wrapperFiles=${metrics.wrapperFileCount}`,
          `barrelFiles=${metrics.barrelFileCount}`,
        ],
        // Weight tiny-file prevalence more heavily, then add extra penalty when
        // wrappers/barrels make up a large share of the directory.
        score: 4 + tinyRatio * 3 + ceremonyRatio * 2,
        locations: [{ path: context.directory!.path, line: 1 }],
      },
    ];
  },
};
