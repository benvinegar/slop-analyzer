# AGENTS.md

`slop-scan` is a deterministic Bun + TypeScript CLI for explainable slop heuristics on JS/TS repositories. It is not an authorship detector.

## Start here

- `README.md` for product behavior and CLI expectations.
- `src/default-registry.ts` for the active languages, facts, rules, and reporters.
- `src/core/engine.ts` for execution flow.
- `tests/heuristics.test.ts` and `tests/fixtures-regression.test.ts` for behavioral expectations.

## Navigation

- CLI entry: `src/cli.ts`
- Core contracts: `src/core/types.ts`
- Fact dependency ordering: `src/core/scheduler.ts`
- Reusable signals: `src/facts/*`
- Findings logic: `src/rules/*`
- Output formats: `src/reporters/*`
- Current language scope: `src/languages/javascript-like.ts`

## Working rules

- Preserve determinism, stable ordering, and explainable evidence.
- Prefer adding/extending facts and rules over special-casing the engine.
- Register new languages, fact providers, rules, and reporters in `src/default-registry.ts`.
- Edit `src/`; `dist/` and benchmark result/report artifacts are generated outputs.
- Do not tune heuristics to a single fixture or benchmark repo.

## Validation

- `bun run format:check`
- `bun run lint` (includes the last published `slop-scan` self-scan regression check)
- `bun test`
- `bun run src/cli.ts scan <path> [--json|--lint]`
- The committed root `slop-scan.config.json` exists mainly for repo self-scan/local validation; it excludes benchmark cache and intentionally slop-heavy fixtures.
- If rule behavior changes, update focused tests and `tests/fixtures-regression.test.ts`.
- If stable self-scan regressions are intentional, refresh `tests/fixtures/self-scan-stable-baseline.json` with `bun run lint:self:update`.
- If benchmark-facing behavior changes materially, rerun `bun run benchmark:update` intentionally.
