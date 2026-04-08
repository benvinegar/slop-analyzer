# slop-scan

Deterministic CLI for finding **AI-associated slop patterns** in JavaScript and TypeScript repositories.

Scan a repo, surface the hotspots, and compare codebases using normalized slop metrics.

> `slop-scan` is a **slop scanner**, not an authorship detector. It reports explainable patterns and suspicious density. It does **not** claim who wrote the code.

## Why use it

- **Find the hotspots fast** — see which files and directories concentrate the most suspicious patterns
- **Understand why something was flagged** — every finding includes a rule ID and evidence
- **Compare repos fairly** — normalize by file count, logical KLOC, and function count
- **Benchmark heuristics over time** — rerun the pinned benchmark set and watch movement

## Good fit for

- checking third-party repos that feel vibe-coded
- comparing known AI-generated repos to mature OSS baselines
- finding low-judgment boilerplate in your own codebase
- iterating on deterministic slop heuristics

## Install

Install globally with npm:

```bash
npm install -g slop-scan
```

Install it in a project and run it with npm tools:

```bash
npm install --save-dev slop-scan
npx slop-scan scan .
```

For local development in this repo:

```bash
bun install
```

## Quick start

Scan the current repo:

```bash
slop-scan scan .
```

Scan the current repo in lint mode:

```bash
slop-scan scan . --lint
```

Scan another repo and get JSON:

```bash
slop-scan scan /path/to/repo --json
```

Recreate the pinned benchmark set from a source checkout:

```bash
bun run benchmark:update
```

## Use it like a linter

Use `--lint` when you want human-readable findings in local runs, CI logs, or PR checks.

```bash
slop-scan scan . --lint
```

Example output:

```text
medium  Found 3 duplicated function signatures  structure.duplicate-function-signatures
  at src/users/normalize.ts:1:1
  at src/teams/normalize.ts:1:1
  at src/accounts/normalize.ts:1:1
```

## JSON output

Use `--json` when you want full-fidelity output for scripts, CI, or post-processing.

```bash
slop-scan scan . --json
```

Example CI check:

```bash
slop-scan scan . --json | jq -e '.summary.findingCount == 0'
```

The CLI currently exits non-zero for CLI/runtime errors, not for findings.

## What it catches

Current checks focus on patterns that often show up in unreviewed generated code:

- needless `try/catch`
- async wrapper / `return await` noise
- pass-through wrappers
- barrel density
- duplicate helper/function signatures across source files
- over-fragmentation
- directory fan-out hotspots
- placeholder comments
- duplicated test mock/setup patterns

## What you get back

- raw repo score
- normalized metrics:
  - score / file
  - score / KLOC
  - score / function
  - findings / file
  - findings / KLOC
  - findings / function
- top file hotspots
- top directory hotspots
- grouped lint-style findings with `--lint`
- full-fidelity findings with evidence in `--json`

## Supported files

Current language support:

- `.ts`
- `.tsx`
- `.js`
- `.jsx`
- `.mjs`
- `.cjs`

## Benchmarks

The repo ships with a **pinned, recreatable benchmark set** comparing known AI-generated repos against older solid OSS repos.

**Blended score** = geometric mean of the six normalized-metric ratios versus the mature OSS cohort medians, then rescaled so the mature OSS cohort median is **1.00**. Higher means a repo is consistently noisier across the benchmark dimensions.

### Cohort medians

| Metric              | AI median | Mature OSS median |     Ratio |
| ------------------- | --------: | ----------------: | --------: |
| Blended score       |  **3.49** |          **1.00** | **3.49x** |
| Score / file        |  **1.00** |          **0.19** | **5.26x** |
| Score / KLOC        |  **9.43** |          **4.42** | **2.13x** |
| Score / function    |  **0.23** |          **0.09** | **2.52x** |
| Findings / file     |  **0.28** |          **0.07** | **4.00x** |
| Findings / KLOC     |  **2.80** |          **1.40** | **2.00x** |
| Findings / function |  **0.08** |          **0.03** | **2.95x** |

### Pinned benchmark snapshot

Ordered by blended score.

| Repository                                                            | Cohort     | Ref       |  Blended | Score/file | Score/KLOC | Findings/file | Findings/KLOC |
| --------------------------------------------------------------------- | ---------- | --------- | -------: | ---------: | ---------: | ------------: | ------------: |
| [`garrytan/gstack`](https://github.com/garrytan/gstack)               | ai         | `6cc094c` | **5.24** |       2.12 |      19.67 |          0.45 |          4.17 |
| [`redwoodjs/agent-ci`](https://github.com/redwoodjs/agent-ci)         | ai         | `4de00d6` | **3.88** |       1.05 |      11.64 |          0.28 |          3.07 |
| [`jiayun/DevWorkbench`](https://github.com/jiayun/DevWorkbench)       | ai         | `ea50862` | **3.77** |       1.00 |      10.76 |          0.44 |          4.69 |
| [`robinebers/openusage`](https://github.com/robinebers/openusage)     | ai         | `857f537` | **3.51** |       1.35 |       8.46 |          0.34 |          2.11 |
| [`openclaw/openclaw`](https://github.com/openclaw/openclaw)           | ai         | `44cf747` | **3.49** |       1.08 |      11.04 |          0.32 |          3.26 |
| [`emdash-cms/emdash`](https://github.com/emdash-cms/emdash)           | ai         | `dbaf8c6` | **2.48** |       0.76 |       6.76 |          0.23 |          2.02 |
| [`FullAgent/fulling`](https://github.com/FullAgent/fulling)           | ai         | `d95060f` | **2.32** |       0.52 |       9.41 |          0.16 |          2.80 |
| [`cloudflare/vinext`](https://github.com/cloudflare/vinext)           | ai         | `28980b0` | **2.23** |       0.50 |       9.43 |          0.14 |          2.72 |
| [`vitejs/vite`](https://github.com/vitejs/vite)                       | mature-oss | `bdc53ab` | **1.65** |       0.26 |       8.06 |          0.08 |          2.43 |
| [`withastro/astro`](https://github.com/withastro/astro)               | mature-oss | `2c9bf5e` | **1.62** |       0.27 |       5.74 |          0.09 |          1.99 |
| [`modem-dev/hunk`](https://github.com/modem-dev/hunk)                 | ai         | `b37663f` | **1.25** |       0.38 |       4.71 |          0.11 |          1.40 |
| [`egoist/tsup`](https://github.com/egoist/tsup)                       | mature-oss | `b906f86` | **1.03** |       0.21 |       3.61 |          0.08 |          1.42 |
| [`umami-software/umami`](https://github.com/umami-software/umami)     | mature-oss | `0a83864` | **1.01** |       0.15 |       4.17 |          0.06 |          1.61 |
| [`sindresorhus/execa`](https://github.com/sindresorhus/execa)         | mature-oss | `f3a2e84` | **0.99** |       0.17 |       4.85 |          0.05 |          1.37 |
| [`antfu-collective/ni`](https://github.com/antfu-collective/ni)       | mature-oss | `6d96905` | **0.73** |       0.11 |       4.68 |          0.02 |          0.94 |
| [`mikaelbr/node-notifier`](https://github.com/mikaelbr/node-notifier) | mature-oss | `b36c237` | **0.46** |       0.08 |       0.90 |          0.04 |          0.47 |
| [`vercel/hyper`](https://github.com/vercel/hyper)                     | mature-oss | `2a7bb18` | **0.43** |       0.60 |       1.05 |          0.15 |          0.26 |

Full benchmark assets:

- manifest: [`benchmarks/sets/known-ai-vs-solid-oss.json`](benchmarks/sets/known-ai-vs-solid-oss.json)
- snapshot: [`benchmarks/results/known-ai-vs-solid-oss.json`](benchmarks/results/known-ai-vs-solid-oss.json)
- report: [`reports/known-ai-vs-solid-oss-benchmark.md`](reports/known-ai-vs-solid-oss-benchmark.md)

## Configuration

The analyzer reads `slop-scan.config.json` from the scan root and also respects root `.gitignore` entries.

```json
{
  "ignores": ["dist/**", "coverage/**", "**/*.generated.ts"],
  "rules": {
    "structure.over-fragmentation": { "enabled": true, "weight": 1.2 },
    "comments.placeholder-comments": { "enabled": false }
  }
}
```

Supported today:

- `ignores`
- `rules.<id>.enabled`
- `rules.<id>.weight`

## How it works

`slop-scan` is built as a pluggable engine:

- language plugins
- fact providers
- rule plugins
- reporters

That keeps the analyzer deterministic and extensible without turning it into one giant loop of ad hoc checks.

## Docs

- benchmark guide: [`benchmarks/README.md`](benchmarks/README.md)
- pinned benchmark report: [`reports/known-ai-vs-solid-oss-benchmark.md`](reports/known-ai-vs-solid-oss-benchmark.md)
- exploratory note on non-JS/TS candidates: [`reports/exploratory-vite-astro-openclaw-beads.md`](reports/exploratory-vite-astro-openclaw-beads.md)

## Contributing

Issues and pull requests are welcome.

Local validation:

```bash
bun run format:check
bun run lint
bun test
```

A Husky pre-commit hook runs the format and lint checks automatically on commit.

If you change rule behavior materially, also rerun:

```bash
bun run benchmark:update
```

## License

MIT
