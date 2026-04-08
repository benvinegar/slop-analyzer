import type { FactProvider } from "../core/types";
import type {
  DuplicateTestSetupCluster,
  DuplicateTestSetupIndex,
  TestMockSetupSummary,
} from "./types";
import { isTestFile } from "./ts-helpers";

const MIN_CLUSTER_FILE_COUNT = 3;
const GENERIC_LABELS = new Set([
  "vi.mock",
  "jest.mock",
  "vi.spyOn",
  "jest.spyOn",
  "sinon.stub",
  "sinon.spy",
]);

export const testDuplicationFactProvider: FactProvider = {
  id: "fact.repo.test-duplication",
  scope: "repo",
  requires: ["repo.files", "file.testMockSetups"],
  provides: ["repo.testMockDuplication"],
  supports(context) {
    return context.scope === "repo";
  },
  run(context) {
    const files = context.runtime.files.filter((file) => isTestFile(file.path));
    const fingerprints = new Map<string, DuplicateTestSetupCluster>();

    for (const file of files) {
      const setups =
        context.runtime.store.getFileFact<TestMockSetupSummary[]>(
          file.path,
          "file.testMockSetups",
        ) ?? [];
      for (const setup of setups) {
        let cluster = fingerprints.get(setup.fingerprint);
        if (!cluster) {
          cluster = {
            fingerprint: setup.fingerprint,
            label: setup.label,
            fileCount: 0,
            occurrences: [],
          };
          fingerprints.set(setup.fingerprint, cluster);
        }

        cluster.occurrences.push({ path: file.path, line: setup.line });
      }
    }

    const clusters = [...fingerprints.values()]
      .map((cluster) => ({
        ...cluster,
        fileCount: new Set(cluster.occurrences.map((occurrence) => occurrence.path)).size,
      }))
      .filter((cluster) => cluster.fileCount >= MIN_CLUSTER_FILE_COUNT)
      .filter((cluster) => !GENERIC_LABELS.has(cluster.label))
      .sort(
        (left, right) => right.fileCount - left.fileCount || left.label.localeCompare(right.label),
      );

    const byFile: Record<string, DuplicateTestSetupCluster[]> = {};
    for (const cluster of clusters) {
      for (const occurrence of cluster.occurrences) {
        byFile[occurrence.path] ??= [];
        byFile[occurrence.path].push(cluster);
      }
    }

    const result: DuplicateTestSetupIndex = { byFile, clusters };
    return { "repo.testMockDuplication": result };
  },
};
