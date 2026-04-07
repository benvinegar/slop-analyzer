# Pinned benchmark: Known AI repos vs older solid OSS repos

Date: 2026-04-07
Analyzer version: 0.1.0
Config mode: default

## Goal

Compare a small cohort of explicitly AI-generated JavaScript/TypeScript repos against older, well-regarded OSS repos using pinned commit SHAs and normalized analyzer metrics.

## Reproduction

```bash
bun run benchmark:fetch
bun run benchmark:scan
bun run benchmark:report
```

Manifest: `benchmarks/sets/known-ai-vs-solid-oss.json`
Snapshot: `benchmarks/results/known-ai-vs-solid-oss.json`
Report: `reports/known-ai-vs-solid-oss-benchmark.md`

The pinned refs below are the exact commits used for the saved snapshot.

## Explicit AI cohort

| Repo | Ref | Age | Stars | Files | Logical LOC | Functions | Score/file | Score/KLOC | Score/function | Findings/file | Findings/KLOC | Findings/function |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `universal-pm` | `2d90bde` | 0.0y | 0 | 18 | 1295 | 149 | 3.43 | 47.64 | 0.41 | 0.83 | 11.58 | 0.10 |
| `voice-notifications` | `8a984b8` | 0.7y | 12 | 5 | 156 | 7 | 1.20 | 38.46 | 0.86 | 0.40 | 12.82 | 0.29 |
| `openusage` | `857f537` | 0.2y | 1715 | 139 | 22270 | 491 | 1.27 | 7.95 | 0.36 | 0.30 | 1.89 | 0.09 |
| `devworkbench` | `ea50862` | 0.8y | 17 | 32 | 2986 | 147 | 1.00 | 10.76 | 0.22 | 0.44 | 4.69 | 0.10 |
| `fulling` | `d95060f` | 0.5y | 2413 | 219 | 12154 | 574 | 0.52 | 9.41 | 0.20 | 0.16 | 2.80 | 0.06 |

## Mature OSS cohort

| Repo | Ref | Age | Stars | Files | Logical LOC | Functions | Score/file | Score/KLOC | Score/function | Findings/file | Findings/KLOC | Findings/function |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `ni` | `6d96905` | 5.4y | 8146 | 87 | 2138 | 99 | 0.11 | 4.68 | 0.10 | 0.02 | 0.94 | 0.02 |
| `node-notifier` | `b36c237` | 13.3y | 5843 | 24 | 2114 | 42 | 0.08 | 0.90 | 0.05 | 0.04 | 0.47 | 0.02 |
| `tsup` | `b906f86` | 6.0y | 11198 | 48 | 2813 | 140 | 0.21 | 3.61 | 0.07 | 0.08 | 1.42 | 0.03 |
| `execa` | `f3a2e84` | 10.3y | 7481 | 581 | 20432 | 1008 | 0.16 | 4.48 | 0.09 | 0.04 | 1.08 | 0.02 |
| `hyper` | `2a7bb18` | 9.8y | 44687 | 115 | 65160 | 5356 | 0.60 | 1.05 | 0.01 | 0.15 | 0.26 | 0.00 |
| `umami` | `0a83864` | 5.7y | 36012 | 674 | 24859 | 1209 | 0.12 | 3.26 | 0.07 | 0.04 | 1.05 | 0.02 |
| `vite` | `bdc53ab` | 6.0y | 79637 | 1433 | 46593 | 2300 | 0.26 | 7.98 | 0.16 | 0.08 | 2.36 | 0.05 |
| `astro` | `2c9bf5e` | 5.1y | 58212 | 2812 | 131236 | 4359 | 0.24 | 5.04 | 0.15 | 0.08 | 1.71 | 0.05 |

## Cohort medians

| Metric | AI median | Solid median | Ratio |
|---|---:|---:|---:|
| Score / file | **1.20** | **0.18** | **6.51x** |
| Score / KLOC | **10.76** | **4.04** | **2.66x** |
| Score / function | **0.36** | **0.08** | **4.42x** |
| Findings / file | **0.40** | **0.06** | **6.76x** |
| Findings / KLOC | **4.69** | **1.06** | **4.42x** |
| Findings / function | **0.10** | **0.02** | **4.17x** |

## Spot-check pairings

| AI repo | Solid repo | Score/file ratio | Score/KLOC ratio | Score/function ratio | Findings/file ratio | Findings/KLOC ratio | Findings/function ratio |
|---|---|---:|---:|---:|---:|---:|---:|
| `universal-pm` | `ni` | 29.82x | 10.19x | 4.10x | 36.25x | 12.38x | 4.98x |
| `voice-notifications` | `node-notifier` | 15.16x | 42.79x | 18.95x | 9.60x | 27.10x | 12.00x |
| `devworkbench` | `hyper` | 1.69x | 10.25x | 17.11x | 2.96x | 17.97x | 30.01x |
| `openusage` | `umami` | 10.59x | 2.44x | 5.38x | 7.83x | 1.80x | 3.98x |

## Top rule families by cohort

### Explicit AI cohort
- `defensive.needless-try-catch` — 50 (46.7%)
- `tests.duplicate-mock-setup` — 29 (27.1%)
- `structure.pass-through-wrappers` — 13 (12.1%)
- `structure.directory-fanout-hotspot` — 7 (6.5%)
- `structure.barrel-density` — 5 (4.7%)
- `defensive.async-noise` — 3 (2.8%)

### Mature OSS cohort
- `defensive.needless-try-catch` — 148 (36.5%)
- `structure.pass-through-wrappers` — 93 (22.9%)
- `structure.directory-fanout-hotspot` — 68 (16.7%)
- `structure.barrel-density` — 47 (11.6%)
- `defensive.async-noise` — 32 (7.9%)
- `structure.over-fragmentation` — 12 (3.0%)

## Notes

- This benchmark is intentionally pinned to exact commit SHAs so future reruns can reproduce the same cohort.
- The benchmark scanner uses the analyzer's default config for every repo to keep results comparable.
- The analyzer still only scans JS/TS-family files, so non-JS/TS portions of mixed-language repos are out of scope.
