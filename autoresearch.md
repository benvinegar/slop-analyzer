# Autoresearch: scanner throughput

## Objective
Improve the throughput of the repository scanner without changing its fundamental architecture, feature set, or observable behavior.

This loop is strictly about pure scan performance. Keep the same rules, outputs, and semantics. Avoid benchmark-specific hacks and do not special-case particular repositories, file names, or paths.

## Metrics
- **Primary**: `total_ms` (ms, lower is better) — summed `analyzeRepository()` time across a representative cached workload.
- **Secondary**: `total_files`, `total_findings`, `total_score`, plus per-repo `SCAN ...` timings printed by the benchmark script.

## How to Run
- `./autoresearch.sh`
- Checks: `./autoresearch.checks.sh`

The benchmark workload scans these cached repos in sequence:
1. `benchmarks/.cache/checkouts/known-ai-vs-solid-oss/agent-ci`
2. `benchmarks/.cache/checkouts/known-ai-vs-solid-oss/umami`
3. `benchmarks/.cache/checkouts/known-ai-vs-solid-oss/astro`
4. `benchmarks/.cache/checkouts/known-ai-vs-solid-oss/openclaw`

This mix covers small, medium, large, and very large JS/TS repositories so we do not overfit to a single codebase.

## Files in Scope
- `src/core/engine.ts` — scan pipeline orchestration
- `src/discovery/walk.ts` — filesystem traversal and ignore matching
- `src/core/fact-store.ts` — runtime fact storage
- `src/facts/*.ts` — fact extraction hot paths
- `src/default-registry.ts` — provider/rule registration if needed for performance-neutral cleanup
- `src/reporters/*.ts` — only if needed for performance without changing output
- `tests/**/*.ts` — regression coverage for behavior-preserving refactors
- `scripts/autoresearch-throughput.ts` — benchmark harness

## Off Limits
- Rule semantics, thresholds, severities, or scoring behavior
- Reporter content/format behavior
- Benchmark manifests or pinned benchmark contents
- Repo-specific skip lists or hard-coded fast paths for benchmark repositories
- New runtime dependencies
- Large architectural rewrites

## Constraints
- Preserve the scanner's behavior and feature set.
- No cheating on the benchmark workload.
- No benchmark-only special casing.
- Keep the current architecture: discovery -> fact providers -> rules -> reporters.
- Any kept change must pass `./autoresearch.checks.sh`.

## What's Been Tried
- Baseline recorded at `total_ms=15205.371` over agent-ci, umami, astro, and openclaw.
- **Kept**: removed an extra `ts.createSourceFile()` from logical LOC counting and replaced `text.split(/\r?\n/)` with a zero-allocation physical line counter. This dropped the workload to `total_ms=10330.611` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: rewrote test mock setup extraction from repeated per-statement subtree rescans into a single AST traversal that accumulates matched mock paths for active statement ancestors. This further dropped the workload to `total_ms=9692.326` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: skipped `hasAwait` subtree scans for non-async functions and skipped duplicate-signature fingerprint generation for test files, since those fingerprints are never consumed. This dropped the workload again to `total_ms=9074.674` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: switched the main file-loading loop from awaited async `readFile()` to synchronous `readFileSync()`. Because the engine already processes files strictly sequentially, this removed per-file promise overhead and dropped the workload to `total_ms=8064.977` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: stopped blindly `await`ing synchronous provider/rule executions in the hot scan loop by only awaiting promise-like results. This shaved the workload further to `total_ms=8016.543` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: reduced hot-loop allocations in `runProviders()` and `runRules()` by avoiding `Object.entries()` and per-rule `map()` copies. This brought the workload down again to `total_ms=7893.872` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: replaced nested `Map`-backed fact buckets with object-backed buckets for repo, directory, and file facts while keeping the same API. This improved hot lookup/set/delete paths and lowered the workload to `total_ms=7847.713` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: stopped cloning the same durable fact set on every file and trimmed retained fact buckets in a single pass. This reduced retention overhead and lowered the workload to `total_ms=7810.091` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: batched the base file fact writes so each file fact bucket is initialized once per file instead of through four separate setter lookups. This shaved the workload to `total_ms=7807.310` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: removed `path.join()` string allocations from try/catch boundary-category detection by matching the few important segment pairs directly (`JSON.parse`, `process.env`). This lowered the workload to `total_ms=7791.422` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: rewrote duplicate-function serialization to use one shared string-parts buffer instead of allocating child string arrays at each node. This cut a large chunk of duplication-fingerprint overhead and dropped the workload to `total_ms=7487.750` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Kept**: applied the same shared string-parts buffer pattern to test mock node-shape fingerprinting. That reduced recursive string churn in test duplication analysis and lowered the workload to `total_ms=7442.580` with unchanged `total_findings=3715` and `total_score=12412.12`.
- **Discarded**: precompiling ignore regexes and swapping `Array.find()` for a manual language loop in discovery made the workload slower on the benchmark mix.
- **Crashed / not kept**: disabling TypeScript parent links looks promising for AST parse cost, but several helpers still assume parent-backed APIs. Revisit only with a more comprehensive cleanup of those assumptions.
- Initial likely hotspots still worth investigating:
  - repeated full-AST walks across multiple fact providers
  - avoid unnecessary AST position work in comment extraction
  - reduce repeated repo/file fact lookups in hot loops where it does not change behavior
