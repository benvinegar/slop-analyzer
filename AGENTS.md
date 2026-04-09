# AGENTS.md

`slop-scan` is a deterministic Bun + TypeScript CLI for explainable slop heuristics on JS/TS repositories. It is not an authorship detector.

## Start here

- `README.md` for product behavior, CLI expectations, and benchmark context.
- `docs/plugins.md` for public plugin configuration and authoring docs.
- `src/default-registry.ts` for the active languages, facts, rules, and reporters.
- `src/core/engine.ts` for execution flow.
- `src/core/types.ts` for provider/rule contracts and result shapes.
- `src/plugin.ts` and `src/config.ts` for the external plugin surface.
- `tests/heuristics.test.ts`, `tests/fixtures-regression.test.ts`, and `tests/plugin-api.test.ts` for behavioral expectations.

## Mental model

- Language plugins decide which files are in scope.
- Fact providers compute reusable signals at `file`, `directory`, or `repo` scope.
- Rules consume facts and emit findings with evidence, severity, and score.
- Reporters render the final analysis as text, lint output, or JSON.
- Config tunes built-ins via `ignores`, `rules`, and path-scoped `overrides`, and can also load third-party **rule** plugins plus `plugin:<namespace>/<config>` presets.

## Navigation

- CLI entry: `src/cli.ts`
- Core contracts: `src/core/types.ts`
- Registry assembly: `src/default-registry.ts`
- Analysis flow and override resolution: `src/core/engine.ts`
- Fact dependency ordering: `src/core/scheduler.ts`
- Shared fact storage: `src/core/fact-store.ts`
- Config discovery / plugin loading / preset resolution: `src/config.ts`
- Public plugin helpers and plugin object shape: `src/plugin.ts`
- Discovery / ignore handling: `src/discovery/walk.ts`
- Reusable signals: `src/facts/*`
- Findings logic: `src/rules/*` (flat files; grouping is by rule `id` / `family`, not folders)
- Output formats: `src/reporters/*`
- Current language scope: `src/languages/javascript-like.ts`

## Working rules

- Preserve determinism, stable ordering, and explainable evidence.
- Prefer adding/extending facts and rules over special-casing the engine.
- New analyzer behavior usually means: extend `src/facts/types.ts` if needed, add/adjust a fact provider, add/adjust a rule, register it in `src/default-registry.ts`, then add tests.
- Rules are manually registered in `src/default-registry.ts`; there is no auto-discovery from `src/rules/`.
- Keep file/directory/repo scopes in mind. This is a repo-scoped analysis engine, not just a bag of single-file lint checks.
- The codebase is internally pluggable and now has an external rule-plugin path. The shipped CLI can load third-party rule plugins and plugin preset configs, but not external fact providers, language plugins, or reporters yet.
- Edit `src/`; `dist/` and benchmark result/report artifacts are generated outputs.
- Do not tune heuristics to a single fixture or benchmark repo.

## Validation

- `bun run format:check`
- `bun run lint` (includes the last published `slop-scan` self-scan regression check)
- `bun test`
- `bun run src/cli.ts scan <path> [--json|--lint]`
- The committed root `slop-scan.config.json` exists mainly for repo self-scan/local validation; it excludes benchmark cache and uses path-scoped overrides to disable directory-structure rules under `src/rules/**`.
- Stable self-scan runs the last published package, so newer config features may lag there; use the committed baseline in `tests/fixtures/self-scan-stable-baseline.json` as the source of truth for accepted stable-release behavior.
- If rule behavior changes, update focused tests and `tests/fixtures-regression.test.ts`.
- If stable self-scan regressions are intentional, refresh `tests/fixtures/self-scan-stable-baseline.json` with `bun run lint:self:update`.
- If benchmark-facing behavior changes materially, rerun `bun run benchmark:update` intentionally.

terially, rerun `bun run benchmark:update` intentionally.
, rerun `bun run benchmark:update` intentionally.
