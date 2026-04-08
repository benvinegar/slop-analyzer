# slop-analyzer

Deterministic CLI for finding **AI-associated slop patterns** in JavaScript and TypeScript repositories.

Scan a repo, surface the hotspots, and compare codebases using normalized slop metrics.

> `slop-analyzer` is a **slop analyzer**, not an authorship detector. It reports explainable patterns and suspicious density. It does **not** claim who wrote the code.

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
npm install -g slop-analyzer
```

Or run it once with npx:

```bash
npx slop-analyzer scan .
```

For local development in this repo:

```bash
bun install
```

## Quick start

Scan the current repo:

```bash
slop-analyzer scan .
```

Scan another repo and get JSON:

```bash
slop-analyzer scan /path/to/repo --json
```

Recreate the pinned benchmark set from a source checkout:

```bash
bun run benchmark:update
```

## What it catches

Current checks focus on patterns that often show up in unreviewed generated code:

- needless `try/catch`
- async wrapper / `return await` noise
- pass-through wrappers
- barrel density
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
- detailed findings with evidence in JSON mode

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

| Metric | AI median | Mature OSS median | Ratio |
|---|---:|---:|---:|
| Blended score | **4.10** | **1.00** | **4.10x** |
| Score / file | **1.00** | **0.18** | **5.45x** |
| Score / KLOC | **9.41** | **4.04** | **2.33x** |
| Score / function | **0.22** | **0.08** | **2.68x** |
| Findings / file | **0.28** | **0.06** | **4.67x** |
| Findings / KLOC | **2.80** | **1.06** | **2.64x** |
| Findings / function | **0.08** | **0.02** | **3.38x** |

### Pinned benchmark snapshot

Ordered by blended score.

| Repository | Cohort | Ref | Blended | Score/file | Score/KLOC | Findings/file | Findings/KLOC |
|---|---|---|---:|---:|---:|---:|---:|
| [`garrytan/gstack`](https://github.com/garrytan/gstack) | ai | `6cc094c` | **6.68** | 2.12 | 19.67 | 0.45 | 4.17 |
| [`redwoodjs/agent-ci`](https://github.com/redwoodjs/agent-ci) | ai | `4de00d6` | **4.95** | 1.05 | 11.64 | 0.28 | 3.07 |
| [`jiayun/DevWorkbench`](https://github.com/jiayun/DevWorkbench) | ai | `ea50862` | **4.81** | 1.00 | 10.76 | 0.44 | 4.69 |
| [`openclaw/openclaw`](https://github.com/openclaw/openclaw) | ai | `44cf747` | **4.15** | 1.01 | 10.31 | 0.30 | 3.02 |
| [`robinebers/openusage`](https://github.com/robinebers/openusage) | ai | `857f537` | **4.10** | 1.27 | 7.95 | 0.30 | 1.89 |
| [`FullAgent/fulling`](https://github.com/FullAgent/fulling) | ai | `d95060f` | **2.96** | 0.52 | 9.41 | 0.16 | 2.80 |
| [`emdash-cms/emdash`](https://github.com/emdash-cms/emdash) | ai | `dbaf8c6` | **2.45** | 0.59 | 5.22 | 0.18 | 1.56 |
| [`vitejs/vite`](https://github.com/vitejs/vite) | mature-oss | `bdc53ab` | **2.07** | 0.26 | 7.98 | 0.08 | 2.36 |
| [`cloudflare/vinext`](https://github.com/cloudflare/vinext) | ai | `28980b0` | **2.04** | 0.37 | 7.03 | 0.10 | 1.88 |
| [`withastro/astro`](https://github.com/withastro/astro) | mature-oss | `2c9bf5e` | **1.80** | 0.24 | 5.04 | 0.08 | 1.71 |
| [`modem-dev/hunk`](https://github.com/modem-dev/hunk) | ai | `b37663f` | **1.60** | 0.38 | 4.71 | 0.11 | 1.40 |
| [`egoist/tsup`](https://github.com/egoist/tsup) | mature-oss | `b906f86` | **1.31** | 0.21 | 3.61 | 0.08 | 1.42 |
| [`sindresorhus/execa`](https://github.com/sindresorhus/execa) | mature-oss | `f3a2e84` | **1.07** | 0.16 | 4.48 | 0.04 | 1.08 |
| [`antfu-collective/ni`](https://github.com/antfu-collective/ni) | mature-oss | `6d96905` | **0.93** | 0.11 | 4.68 | 0.02 | 0.94 |
| [`umami-software/umami`](https://github.com/umami-software/umami) | mature-oss | `0a83864` | **0.92** | 0.12 | 3.26 | 0.04 | 1.05 |
| [`mikaelbr/node-notifier`](https://github.com/mikaelbr/node-notifier) | mature-oss | `b36c237` | **0.59** | 0.08 | 0.90 | 0.04 | 0.47 |
| [`vercel/hyper`](https://github.com/vercel/hyper) | mature-oss | `2a7bb18` | **0.55** | 0.60 | 1.05 | 0.15 | 0.26 |

Full benchmark assets:
- manifest: [`benchmarks/sets/known-ai-vs-solid-oss.json`](benchmarks/sets/known-ai-vs-solid-oss.json)
- snapshot: [`benchmarks/results/known-ai-vs-solid-oss.json`](benchmarks/results/known-ai-vs-solid-oss.json)
- report: [`reports/known-ai-vs-solid-oss-benchmark.md`](reports/known-ai-vs-solid-oss-benchmark.md)

## Configuration

The analyzer reads `repo-slop.config.json` from the scan root.

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

`slop-analyzer` is built as a pluggable engine:
- language plugins
- fact providers
- rule plugins
- reporters

That keeps the analyzer deterministic and extensible without turning it into one giant loop of ad hoc checks.

## Docs

- benchmark guide: [`benchmarks/README.md`](benchmarks/README.md)
- pinned benchmark report: [`reports/known-ai-vs-solid-oss-benchmark.md`](reports/known-ai-vs-solid-oss-benchmark.md)
- exploratory note on non-JS/TS candidates: [`reports/exploratory-vite-astro-openclaw-beads.md`](reports/exploratory-vite-astro-openclaw-beads.md)
- project spec: [`PROJECT_SPEC.md`](PROJECT_SPEC.md)

## Contributing

Issues and pull requests are welcome.

If you change rule behavior, rerun:

```bash
bun test
bun run benchmark:update
```

## License

A `LICENSE` file has not been added yet.
