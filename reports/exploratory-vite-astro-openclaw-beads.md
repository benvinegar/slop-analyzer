# Exploratory overfitting check: Vite, Astro, openclaw, and beads

Date: 2026-04-07

## Goal

Sanity-check the analyzer against a few additional repos suggested during calibration:

- mature OSS baselines: `vite`, `astro`
- AI-slop candidates: `openclaw`, `beads`

This is an **exploratory** report, not the strict pinned benchmark cohort.

## Why exploratory instead of fully pinned

- `vite` and `astro` are straightforward mature OSS additions and were added to the pinned benchmark set.
- `openclaw` looks like a useful high-slop candidate, but I did **not** find an explicit repo-level claim that it is fully AI-generated, so I kept it out of the strict `explicit-ai` cohort for now.
- `beads` is mostly Go, so the current JS/TS-only analyzer sees too little of the repo to make the result trustworthy.

## Results

| Repo | Role in this check | JS/TS files scanned | Logical LOC | Score/file | Score/KLOC | Findings/file | Findings/KLOC | Notes |
|---|---|---:|---:|---:|---:|---:|---:|---|
| `vitejs/vite` | mature OSS baseline | 1433 | 46593 | 0.26 | 7.98 | 0.08 | 2.36 | Large mature TS monorepo; higher than tiny libraries, still far below obvious slop cases |
| `withastro/astro` | mature OSS baseline | 2812 | 131236 | 0.24 | 5.04 | 0.08 | 1.71 | Large mature framework monorepo; lands in the same general band as other solid repos |
| `openclaw/openclaw` | exploratory AI-slop candidate | 10580 | 1038026 | 1.01 | 10.31 | 0.30 | 3.02 | Huge TS surface and clearly noisier than the mature baseline set |
| `gastownhall/beads` | exploratory AI-slop candidate | 6 | 397 | 0.17 | 2.52 | 0.17 | 2.52 | Not suitable for current benchmark; repo is overwhelmingly Go |

## Read on Vite and Astro

These were the important anti-overfitting checks.

### `vite`
- `score/file = 0.26`
- `score/KLOC = 7.98`
- `findings/file = 0.08`
- `findings/KLOC = 2.36`

### `astro`
- `score/file = 0.24`
- `score/KLOC = 5.04`
- `findings/file = 0.08`
- `findings/KLOC = 1.71`

Both are above the very cleanest mature repos like `node-notifier`, but they still sit much closer to the mature OSS control range than to obvious slop-heavy cases.

That is a good sign:

> after the recent calibration pass, the analyzer is not collapsing modern, large, legitimate TypeScript monorepos into the same bucket as the sloppiest AI-associated repos.

## Read on openclaw

`openclaw` is interesting because it has a **huge** TypeScript footprint, so it is a much more meaningful stress test than tiny toy repos.

### Summary
- `score/file = 1.01`
- `score/KLOC = 10.31`
- `findings/file = 0.30`
- `findings/KLOC = 3.02`

### Top rule families
- `tests.duplicate-mock-setup` — 1003
- `defensive.needless-try-catch` — 683
- `structure.pass-through-wrappers` — 624
- `structure.barrel-density` — 415
- `defensive.async-noise` — 315

### Interpretation

Even after the mature-repo calibration, `openclaw` still lands **well above** the updated mature OSS medians.

Relative to the current mature OSS cohort median:
- score/file is about **5.6x** higher
- score/KLOC is about **2.6x** higher

So as an exploratory candidate, it still looks distinctly noisy.

However, I would keep it out of the strict `explicit-ai` cohort until we have a better provenance basis than "it feels AI-ish" or a user suggestion.

## Read on beads

`beads` is not a good fit for the current analyzer.

### Why
The analyzer currently scans only:
- `.ts`
- `.tsx`
- `.js`
- `.jsx`
- `.mjs`
- `.cjs`

But `beads` is mostly Go. The scan only saw:
- **6 supported files**
- **397 logical LOC**

That means the current result is basically just a tiny JS/TS slice of a Go codebase, not a meaningful repo-level judgment.

## Takeaway

This extra check is encouraging.

- Adding **Vite** and **Astro** makes the mature OSS cohort broader and more credible.
- Both still land far below the sloppier AI-associated repos.
- **openclaw** looks like a promising exploratory slop candidate with a large enough TS surface to be meaningful.
- **beads** should be excluded from JS/TS benchmark claims until the analyzer supports Go.

## Recommended next step

1. Keep `vite` and `astro` in the pinned mature OSS cohort.
2. Keep `openclaw` in an exploratory bucket unless we find stronger provenance evidence.
3. Exclude `beads` from benchmark claims for now.
4. If Go support is added later, revisit `beads` and similar mixed-language repos.
