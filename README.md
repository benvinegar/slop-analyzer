# repo-slop-analyzer

Deterministic CLI for finding **AI-associated slop patterns** in JavaScript and TypeScript repositories.

Scan a repo, surface the hotspots, and compare codebases using normalized slop metrics.

> `repo-slop-analyzer` is a **slop analyzer**, not an authorship detector. It reports explainable patterns and suspicious density. It does **not** claim who wrote the code.

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

```bash
bun install
```

## Quick start

Scan the current repo:

```bash
bun run src/cli.ts scan .
```

Scan another repo and get JSON:

```bash
bun run src/cli.ts scan /path/to/repo --json
```

Recreate the pinned benchmark set:

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

### Cohort medians

| Metric | AI median | Mature OSS median | Ratio |
|---|---:|---:|---:|
| Score / file | **1.01** | **0.18** | **5.49x** |
| Score / KLOC | **10.31** | **4.04** | **2.55x** |
| Score / function | **0.26** | **0.08** | **3.22x** |
| Findings / file | **0.30** | **0.06** | **5.10x** |
| Findings / KLOC | **3.02** | **1.06** | **2.85x** |
| Findings / function | **0.09** | **0.02** | **3.75x** |

### Pinned benchmark snapshot

| Repository | Cohort | Ref | Score/file | Score/KLOC | Findings/file | Findings/KLOC |
|---|---|---|---:|---:|---:|---:|
| [`golusprasad12-arch/universal-pm`](https://github.com/golusprasad12-arch/universal-pm) | ai | `2d90bde` | 3.43 | 47.64 | 0.83 | 11.58 |
| [`ZeldOcarina/claude-code-voice-notifications`](https://github.com/ZeldOcarina/claude-code-voice-notifications) | ai | `8a984b8` | 1.20 | 38.46 | 0.40 | 12.82 |
| [`robinebers/openusage`](https://github.com/robinebers/openusage) | ai | `857f537` | 1.27 | 7.95 | 0.30 | 1.89 |
| [`jiayun/DevWorkbench`](https://github.com/jiayun/DevWorkbench) | ai | `ea50862` | 1.00 | 10.76 | 0.44 | 4.69 |
| [`FullAgent/fulling`](https://github.com/FullAgent/fulling) | ai | `d95060f` | 0.52 | 9.41 | 0.16 | 2.80 |
| [`openclaw/openclaw`](https://github.com/openclaw/openclaw) | ai | `44cf747` | 1.01 | 10.31 | 0.30 | 3.02 |
| [`emdash-cms/emdash`](https://github.com/emdash-cms/emdash) | ai | `dbaf8c6` | 0.59 | 5.22 | 0.18 | 1.56 |
| [`antfu-collective/ni`](https://github.com/antfu-collective/ni) | mature-oss | `6d96905` | 0.11 | 4.68 | 0.02 | 0.94 |
| [`mikaelbr/node-notifier`](https://github.com/mikaelbr/node-notifier) | mature-oss | `b36c237` | 0.08 | 0.90 | 0.04 | 0.47 |
| [`egoist/tsup`](https://github.com/egoist/tsup) | mature-oss | `b906f86` | 0.21 | 3.61 | 0.08 | 1.42 |
| [`sindresorhus/execa`](https://github.com/sindresorhus/execa) | mature-oss | `f3a2e84` | 0.16 | 4.48 | 0.04 | 1.08 |
| [`vercel/hyper`](https://github.com/vercel/hyper) | mature-oss | `2a7bb18` | 0.60 | 1.05 | 0.15 | 0.26 |
| [`umami-software/umami`](https://github.com/umami-software/umami) | mature-oss | `0a83864` | 0.12 | 3.26 | 0.04 | 1.05 |
| [`vitejs/vite`](https://github.com/vitejs/vite) | mature-oss | `bdc53ab` | 0.26 | 7.98 | 0.08 | 2.36 |
| [`withastro/astro`](https://github.com/withastro/astro) | mature-oss | `2c9bf5e` | 0.24 | 5.04 | 0.08 | 1.71 |

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

`repo-slop-analyzer` is built as a pluggable engine:
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
date
```

## License

A `LICENSE` file has not been added yet.
