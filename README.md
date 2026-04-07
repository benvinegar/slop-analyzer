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
- comparing explicit-AI repos to mature OSS baselines
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

The repo ships with a **pinned, recreatable benchmark set** comparing explicit-AI repos against older solid OSS repos.

### Cohort medians

| Metric | Explicit-AI median | Mature OSS median | Ratio |
|---|---:|---:|---:|
| Score / file | **1.20** | **0.18** | **6.51x** |
| Score / KLOC | **10.76** | **4.04** | **2.66x** |
| Score / function | **0.36** | **0.08** | **4.42x** |
| Findings / file | **0.40** | **0.06** | **6.76x** |
| Findings / KLOC | **4.69** | **1.06** | **4.42x** |
| Findings / function | **0.10** | **0.02** | **4.17x** |

### Pinned benchmark snapshot

| Repo | Cohort | Ref | Score/file | Score/KLOC | Findings/file | Findings/KLOC |
|---|---|---|---:|---:|---:|---:|
| `universal-pm` | explicit-ai | `2d90bde` | 3.43 | 47.64 | 0.83 | 11.58 |
| `voice-notifications` | explicit-ai | `8a984b8` | 1.20 | 38.46 | 0.40 | 12.82 |
| `openusage` | explicit-ai | `857f537` | 1.27 | 7.95 | 0.30 | 1.89 |
| `devworkbench` | explicit-ai | `ea50862` | 1.00 | 10.76 | 0.44 | 4.69 |
| `fulling` | explicit-ai | `d95060f` | 0.52 | 9.41 | 0.16 | 2.80 |
| `ni` | mature-oss | `6d96905` | 0.11 | 4.68 | 0.02 | 0.94 |
| `node-notifier` | mature-oss | `b36c237` | 0.08 | 0.90 | 0.04 | 0.47 |
| `tsup` | mature-oss | `b906f86` | 0.21 | 3.61 | 0.08 | 1.42 |
| `execa` | mature-oss | `f3a2e84` | 0.16 | 4.48 | 0.04 | 1.08 |
| `hyper` | mature-oss | `2a7bb18` | 0.60 | 1.05 | 0.15 | 0.26 |
| `umami` | mature-oss | `0a83864` | 0.12 | 3.26 | 0.04 | 1.05 |
| `vite` | mature-oss | `bdc53ab` | 0.26 | 7.98 | 0.08 | 2.36 |
| `astro` | mature-oss | `2c9bf5e` | 0.24 | 5.04 | 0.08 | 1.71 |

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
- exploratory overfitting check: [`reports/exploratory-vite-astro-openclaw-beads.md`](reports/exploratory-vite-astro-openclaw-beads.md)
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
