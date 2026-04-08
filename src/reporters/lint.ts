import type { AnalysisResult, Finding, FindingLocation, ReporterPlugin } from "../core/types";

const MAX_FILE_GROUP_PREVIEW = 5;
const MAX_LOCATION_PREVIEW_PER_FILE = 3;

interface LocationGroup {
  path: string;
  entries: Array<{ line: number; column: number }>;
}

function fallbackLocation(finding: Finding): FindingLocation {
  return {
    path: finding.path ?? "<unknown>",
    line: 1,
    column: 1,
  };
}

function compareLocations(left: FindingLocation, right: FindingLocation): number {
  return (
    left.path.localeCompare(right.path)
    || left.line - right.line
    || (left.column ?? 1) - (right.column ?? 1)
  );
}

function uniqueSortedLocations(finding: Finding): FindingLocation[] {
  const locations = finding.locations.length > 0 ? finding.locations : [fallbackLocation(finding)];
  const seen = new Set<string>();

  return [...locations]
    .sort(compareLocations)
    .filter((location) => {
      const key = `${location.path}:${location.line}:${location.column ?? 1}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function primaryLocation(finding: Finding): FindingLocation {
  return uniqueSortedLocations(finding)[0] ?? fallbackLocation(finding);
}

function compareFindings(left: Finding, right: Finding): number {
  const leftPrimary = primaryLocation(left);
  const rightPrimary = primaryLocation(right);

  return (
    compareLocations(leftPrimary, rightPrimary)
    || left.ruleId.localeCompare(right.ruleId)
    || left.message.localeCompare(right.message)
  );
}

function groupLocations(locations: FindingLocation[]): LocationGroup[] {
  const groups: LocationGroup[] = [];

  for (const location of locations) {
    const column = location.column ?? 1;
    const last = groups.at(-1);
    if (last && last.path === location.path) {
      last.entries.push({ line: location.line, column });
      continue;
    }

    groups.push({
      path: location.path,
      entries: [{ line: location.line, column }],
    });
  }

  return groups;
}

function formatEntry(entry: { line: number; column: number }): string {
  return `${entry.line}:${entry.column}`;
}

function formatGroup(group: LocationGroup): string {
  const preview = group.entries.slice(0, MAX_LOCATION_PREVIEW_PER_FILE);
  const hiddenCount = group.entries.length - preview.length;
  const suffix = preview.map(formatEntry).join(", ");

  return hiddenCount > 0
    ? `  at ${group.path}:${suffix}, ... (+${hiddenCount} more)`
    : `  at ${group.path}:${suffix}`;
}

function renderFinding(finding: Finding): string {
  const locations = uniqueSortedLocations(finding);
  const groups = groupLocations(locations);
  const previewGroups = groups.slice(0, MAX_FILE_GROUP_PREVIEW);
  const hiddenGroups = groups.slice(MAX_FILE_GROUP_PREVIEW);
  const lines = [`${finding.severity}  ${finding.message}  ${finding.ruleId}`];

  for (const group of previewGroups) {
    lines.push(formatGroup(group));
  }

  if (hiddenGroups.length > 0) {
    lines.push(`  ... and ${hiddenGroups.length} more file${hiddenGroups.length === 1 ? "" : "s"}`);
  }

  return lines.join("\n");
}

export const lintReporter: ReporterPlugin = {
  id: "lint",
  render(result: AnalysisResult): string {
    const renderedFindings = [...result.findings]
      .sort(compareFindings)
      .map(renderFinding)
      .filter((rendered, index, values) => values.indexOf(rendered) === index);

    if (renderedFindings.length === 0) {
      return "0 findings";
    }

    return [
      ...renderedFindings,
      "",
      `${renderedFindings.length} finding${renderedFindings.length === 1 ? "" : "s"}`,
    ].join("\n\n");
  },
};
