# AI-slop comparison: `universal-pm` vs `ni`

Date: 2026-04-06

## Goal

Compare one repo that explicitly describes itself as AI-generated against one well-regarded manual TypeScript repo in a similar domain.

## Repos

### AI repo
- Repo: `golusprasad12-arch/universal-pm`
- Why selected: the README explicitly says **"This project is 100% AI-generated code."**
- Domain: package-manager CLI

### Manual repo
- Repo: `antfu-collective/ni`
- Why selected: mature, well-regarded TypeScript package-manager CLI by Anthony Fu
- Domain: package-manager CLI

## Commands used

```bash
bun run src/cli.ts scan /tmp/aicand-ZTXEM9 --json
bun run src/cli.ts scan /tmp/ni-JjVTWC --json
```

## Summary

| Metric | universal-pm | ni |
|---|---:|---:|
| Source files scanned | 18 | 87 |
| Findings | 23 | 14 |
| Repo score (raw) | 88.70 | 62.87 |
| Physical LOC | 4845 | 3569 |
| Logical LOC | 1295 | 2138 |
| Function count | 149 | 99 |

## Normalized metrics

| Metric | universal-pm | ni | Relative result |
|---|---:|---:|---|
| Score / file | **4.93** | **0.72** | universal-pm ~6.8x higher |
| Findings / file | **1.28** | **0.16** | universal-pm ~8.0x higher |
| Score / KLOC | **68.49** | **29.41** | universal-pm ~2.3x higher |
| Findings / KLOC | **17.76** | **6.55** | universal-pm ~2.7x higher |
| Score / function | 0.60 | 0.64 | roughly similar |
| Findings / function | 0.15 | 0.14 | roughly similar |

## Interpretation

### Strong signal

The most useful normalized metrics in this comparison are:

- **score / file**
- **findings / file**
- **score / KLOC**
- **findings / KLOC**

Across those, `universal-pm` is consistently much noisier than `ni`.

### Weak signal

Per-function normalization is less discriminative here:

- `score / function` is roughly flat
- `findings / function` is also close

That suggests many current findings are driven by:
- file-level organization,
- wrapper density,
- repeated defensive patterns,
- and repo structure,

more than by raw function count alone.

## Rule mix

### universal-pm

| Rule | Count |
|---|---:|
| `defensive.needless-try-catch` | 11 |
| `defensive.async-noise` | 8 |
| `structure.pass-through-wrappers` | 3 |
| `structure.directory-fanout-hotspot` | 1 |
| `tests.duplicate-mock-setup` | 0 |

### ni

| Rule | Count |
|---|---:|
| `structure.over-fragmentation` | 7 |
| `defensive.async-noise` | 5 |
| `structure.barrel-density` | 1 |
| `structure.directory-fanout-hotspot` | 1 |
| `tests.duplicate-mock-setup` | 0 |

## Hotspots

### universal-pm
Top files:
- `src/index.ts` — 14.0
- `src/commands/index.ts` — 12.0
- `src/commands/utilities.ts` — 11.4
- `src/commands/update.ts` — 10.0
- `src/services/manager.ts` — 10.0

This repo is dominated by:
- defensive command wrappers,
- repeated async helpers,
- monolithic command plumbing,
- pass-through abstractions.

### ni
Top files:
- `src/catalog/pnpm.ts` — 3.0
- `src/index.ts` — 3.0
- `src/commands/ni.ts` — 1.5
- `src/commands/nr.ts` — 1.5
- `src/commands/nun.ts` — 1.5

This repo is mostly being hit for:
- modular tiny-file structure,
- some async patterns,
- one barrel file,

not for the heavier defensive/wrapper clutter seen in `universal-pm`.

## About the test-duplication rule

A new rule was added in this pass:

- `tests.duplicate-mock-setup`

In this comparison:
- `universal-pm`: **0** hits
- `ni`: **0** hits

This is still informative because it means the rule did **not** spuriously penalize `ni` for having a large test suite.

## Takeaway

The analyzer currently distinguishes these repos in a direction that makes sense, especially on the normalized metrics that seem most meaningful right now:

- **per file**
- **per KLOC**

Those metrics suggest the explicitly AI-generated repo is materially noisier than the manual one.

## Caveats

1. `repoScore` is still a raw aggregate, not a calibrated quality score.
2. `ni` still gets structural penalties for intentionally modular layouts.
3. Per-function normalization is currently not very useful for this benchmark pair.
4. A better benchmark set should include several AI and manual repos in the same category.

## Recommended next steps

1. Add duplicate function / near-clone detection.
2. Refine `over-fragmentation` so intentionally data-driven test matrices are downweighted.
3. Differentiate boundary CLI wrappers from leaf business-logic wrappers more sharply.
4. Build a small multi-repo benchmark suite with saved snapshots.
