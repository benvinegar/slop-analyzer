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

- log-and-continue catch blocks
- error-obscuring catch blocks (default-return or generic replacement error)
- empty catch blocks
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
| Blended score       |  **3.48** |          **1.00** | **3.48x** |
| Score / file        |  **0.99** |          **0.19** | **5.17x** |
| Score / KLOC        |  **9.51** |          **4.42** | **2.15x** |
| Score / function    |  **0.23** |          **0.09** | **2.49x** |
| Findings / file     |  **0.31** |          **0.07** | **4.44x** |
| Findings / KLOC     |  **2.96** |          **1.40** | **2.12x** |
| Findings / function |  **0.08** |          **0.03** | **2.99x** |

### Pinned benchmark snapshot

Ordered by blended score.

| Repository                                                            | Cohort     | Ref       |  Blended | Score/file | Score/KLOC | Findings/file | Findings/KLOC |
| --------------------------------------------------------------------- | ---------- | --------- | -------: | ---------: | ---------: | ------------: | ------------: |
| [`garrytan/gstack`](https://github.com/garrytan/gstack)               | ai         | `6cc094c` | **5.94** |       2.34 |      21.71 |          0.52 |          4.85 |
| [`redwoodjs/agent-ci`](https://github.com/redwoodjs/agent-ci)         | ai         | `4de00d6` | **3.98** |       0.99 |      10.95 |          0.31 |          3.42 |
| [`jiayun/DevWorkbench`](https://github.com/jiayun/DevWorkbench)       | ai         | `ea50862` | **3.77** |       1.00 |      10.76 |          0.44 |          4.69 |
| [`openclaw/openclaw`](https://github.com/openclaw/openclaw)           | ai         | `44cf747` | **3.50** |       1.08 |      10.93 |          0.32 |          3.29 |
| [`robinebers/openusage`](https://github.com/robinebers/openusage)     | ai         | `857f537` | **3.48** |       1.33 |       8.30 |          0.34 |          2.11 |
| [`emdash-cms/emdash`](https://github.com/emdash-cms/emdash)           | ai         | `dbaf8c6` | **2.47** |       0.75 |       6.67 |          0.23 |          2.02 |
| [`FullAgent/fulling`](https://github.com/FullAgent/fulling)           | ai         | `d95060f` | **2.40** |       0.53 |       9.51 |          0.16 |          2.96 |
| [`cloudflare/vinext`](https://github.com/cloudflare/vinext)           | ai         | `28980b0` | **2.21** |       0.48 |       9.20 |          0.15 |          2.76 |
| [`vitejs/vite`](https://github.com/vitejs/vite)                       | mature-oss | `bdc53ab` | **1.65** |       0.26 |       7.95 |          0.08 |          2.45 |
| [`withastro/astro`](https://github.com/withastro/astro)               | mature-oss | `2c9bf5e` | **1.63** |       0.27 |       5.68 |          0.09 |          2.02 |
| [`modem-dev/hunk`](https://github.com/modem-dev/hunk)                 | ai         | `b37663f` | **1.32** |       0.38 |       4.71 |          0.13 |          1.55 |
| [`egoist/tsup`](https://github.com/egoist/tsup)                       | mature-oss | `b906f86` | **1.03** |       0.21 |       3.61 |          0.08 |          1.42 |
| [`umami-software/umami`](https://github.com/umami-software/umami)     | mature-oss | `0a83864` | **1.01** |       0.15 |       4.17 |          0.06 |          1.61 |
| [`sindresorhus/execa`](https://github.com/sindresorhus/execa)         | mature-oss | `f3a2e84` | **0.99** |       0.17 |       4.85 |          0.05 |          1.37 |
| [`antfu-collective/ni`](https://github.com/antfu-collective/ni)       | mature-oss | `6d96905` | **0.73** |       0.11 |       4.68 |          0.02 |          0.94 |
| [`mikaelbr/node-notifier`](https://github.com/mikaelbr/node-notifier) | mature-oss | `b36c237` | **0.46** |       0.08 |       0.90 |          0.04 |          0.47 |
| [`vercel/hyper`](https://github.com/vercel/hyper)                     | mature-oss | `2a7bb18` | **0.46** |       0.65 |       1.12 |          0.16 |          0.28 |

Full benchmark assets:

- manifest: [`benchmarks/sets/known-ai-vs-solid-oss.json`](benchmarks/sets/known-ai-vs-solid-oss.json)
- snapshot: [`benchmarks/results/known-ai-vs-solid-oss.json`](benchmarks/results/known-ai-vs-solid-oss.json)
- report: [`reports/known-ai-vs-solid-oss-benchmark.md`](reports/known-ai-vs-solid-oss-benchmark.md)

## Configuration

The analyzer reads `slop-scan.config.ts`, `slop-scan.config.js`, `slop-scan.config.mjs`, `slop-scan.config.cjs`, or `slop-scan.config.json` from the scan root. Root `.gitignore` entries are also respected.

```json
{
  "ignores": ["dist/**", "coverage/**", "**/*.generated.ts"],
  "plugins": {
    "acme": "slop-scan-plugin-acme"
  },
  "extends": ["plugin:acme/recommended"],
  "rules": {
    "structure.over-fragmentation": { "enabled": true, "weight": 1.2 },
    "comments.placeholder-comments": { "enabled": false },
    "acme/no-generated-wrapper": { "enabled": true, "options": { "threshold": 3 } }
  },
  "overrides": [
    {
      "files": ["src/rules/**"],
      "rules": {
        "structure.directory-fanout-hotspot": { "enabled": false },
        "structure.over-fragmentation": { "enabled": false }
      }
    }
  ]
}
```

Supported today:

- `ignores`
- `plugins.<namespace>` as either a package/path string or a plugin object in module configs
- `extends: ["plugin:<namespace>/<config>"]`
- `rules.<id>.enabled`
- `rules.<id>.weight`
- `rules.<id>.options`
- `overrides[].files`
- `overrides[].rules.<id>.enabled`
- `overrides[].rules.<id>.weight`
- `overrides[].rules.<id>.options`

### Plugins

`slop-scan` can load third-party rule plugins and plugin preset configs from JSON or module configs.

For plugin setup, naming rules, and authoring examples, see [docs/plugins.md](docs/plugins.md).

See also:

- [`examples/local-plugin/contains-word-plugin.mjs`](examples/local-plugin/contains-word-plugin.mjs)
- [`examples/local-plugin/slop-scan.config.ts`](examples/local-plugin/slop-scan.config.ts)

This repo also commits a root [`slop-scan.config.json`](slop-scan.config.json) for self-scans and local development. It keeps the scan focused on the tool itself by excluding heavyweight benchmark checkouts and intentionally disables directory-structure rules under `src/rules/**`.

## How it works

`slop-scan` is built as a pluggable engine:

- language plugins
- fact providers
- rule plugins
- reporters

That keeps the analyzer deterministic and extensible without turning it into one giant loop of ad hoc checks.

## Docs

- plugin guide: [`docs/plugins.md`](docs/plugins.md)
- benchmark guide: [`benchmarks/README.md`](benchmarks/README.md)
- pinned benchmark report: [`reports/known-ai-vs-solid-oss-benchmark.md`](reports/known-ai-vs-solid-oss-benchmark.md)
- exploratory note on non-JS/TS candidates: [`reports/exploratory-vite-astro-openclaw-beads.md`](reports/exploratory-vite-astro-openclaw-beads.md)

## Contributing

Issues and pull requests are welcome.

### Local validation

```bash
bun run format:check
bun run lint
bun test
```

### Stable self-scan

`bun run lint` includes a stable self-scan.

It runs the last published `slop-scan` release against this repo using the committed root config in [`slop-scan.config.json`](slop-scan.config.json), then compares the result to [`tests/fixtures/self-scan-stable-baseline.json`](tests/fixtures/self-scan-stable-baseline.json).

The check currently fails only when the stable release reports either:

- a higher finding count; or
- a higher repo score.

Useful commands:

```bash
bun run lint:self
bun run lint:self:update
```

Use `bun run lint:self:update` only when you intentionally accept the new stable self-scan baseline.

### Pre-commit hook

A Husky pre-commit hook runs:

```bash
bun run format:check
bun run lint
```

### Heuristic changes

If you change rule behavior materially, also rerun:

```bash
bun run benchmark:update
```

## License

MIT
