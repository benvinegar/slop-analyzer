import type { RulePlugin } from "../core/types";
import type { FunctionSummary } from "../facts/types";
import { BOUNDARY_WRAPPER_TARGET_PREFIXES } from "./helpers";

/**
 * Flags async-related ceremony that adds little value:
 * - `return await` around a direct call
 * - trivial async pass-through wrappers with no internal awaiting
 *
 * Boundary wrappers are exempted because framework, network, storage, and other
 * edge-facing code often preserves async signatures on purpose.
 */
export const asyncNoiseRule: RulePlugin = {
  id: "defensive.async-noise",
  family: "defensive",
  severity: "medium",
  scope: "file",
  requires: ["file.functionSummaries"],
  supports(context) {
    return context.scope === "file" && Boolean(context.file);
  },
  evaluate(context) {
    const functions =
      context.runtime.store.getFileFact<FunctionSummary[]>(
        context.file!.path,
        "file.functionSummaries",
      ) ?? [];

    // Keep the two sub-signals separate so we can weight redundant `return await`
    // more heavily than a plain pass-through async wrapper.
    const redundantReturnAwait = functions.filter((summary) => summary.hasReturnAwaitCall);
    const asyncPassThroughWrappers = functions.filter(
      (summary) =>
        summary.isAsync &&
        !summary.hasAwait &&
        summary.isPassThroughWrapper &&
        !summary.hasReturnAwaitCall &&
        // Edge-facing wrappers often keep async signatures for API consistency.
        !BOUNDARY_WRAPPER_TARGET_PREFIXES.some((prefix) =>
          summary.passThroughTarget?.startsWith(prefix),
        ),
    );
    const noisy = [...redundantReturnAwait, ...asyncPassThroughWrappers];

    if (noisy.length === 0) {
      return [];
    }

    // Bound the contribution from one file so this stays a hotspot signal rather
    // than dominating the total repo score.
    const score = Math.min(
      4,
      redundantReturnAwait.length * 1.5 + asyncPassThroughWrappers.length * 0.75,
    );

    return [
      {
        ruleId: "defensive.async-noise",
        family: "defensive",
        severity: "medium",
        scope: "file",
        path: context.file!.path,
        message: `Found ${noisy.length} async-noise pattern${noisy.length === 1 ? "" : "s"}`,
        evidence: noisy.map((summary) => {
          const kind = summary.hasReturnAwaitCall ? "return-await" : "async-pass-through";
          return `${summary.name} at line ${summary.line} (${kind})`;
        }),
        score,
        locations: noisy.map((summary) => ({ path: context.file!.path, line: summary.line })),
      },
    ];
  },
};
