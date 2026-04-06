# repo-slop-analyzer

Deterministic Bun + TypeScript tooling for finding **AI-associated slop patterns** in a codebase.

This project is intentionally framed as a **slop analyzer**, not an authorship detector.
It looks for explainable patterns commonly found in low-judgment, unreviewed AI output and reports where the hotspots are.

## Current status

The repo currently ships a working CLI, a pluggable analysis engine, an initial TypeScript/JavaScript rule pack, and a regression suite with fixture repos.

## Why this exists

AI-generated code often leaves recognizable structural and stylistic residue:

- defensive `try/catch` blocks that mostly log and return defaults
- async wrappers and `return await` noise
- pass-through wrappers and shallow indirection
- barrel-heavy module organization
- over-fragmented directories with many tiny files
- placeholder comments like “add more validation if needed”

The goal is to detect those patterns **deterministically** and **explainably**.

## Install

```bash
bun install
```

## Usage

### Scan the current repo

```bash
bun run src/cli.ts scan .
```

### Get machine-readable JSON

```bash
bun run src/cli.ts scan . --json
```

### Scan a fixture repo

```bash
bun run src/cli.ts scan tests/fixtures/repos/slop-heavy
```

## Testing

Run the full regression suite:

```bash
bun test
```

The tests include:

- scheduler and engine unit tests
- heuristic rule tests against temporary repos
- fixture regression tests against persistent example repos
- CLI end-to-end JSON regression coverage

Fixture repos live in:

- `tests/fixtures/repos/clean`
- `tests/fixtures/repos/slop-heavy`
- `tests/fixtures/repos/mixed`

## Architecture

The architecture is intentionally **pluggable**.

It is built around four concepts:

1. **language plugins**
   - decide which files are analyzable
2. **fact providers**
   - produce reusable facts like ASTs, comments, function summaries, try/catch summaries, and directory metrics
3. **rule plugins**
   - consume facts and emit findings
4. **reporters**
   - render text or JSON output

### Execution flow

1. discover files
2. classify supported languages
3. run file-scoped fact providers
4. run directory-scoped fact providers
5. run rule plugins
6. aggregate scores
7. render reports

This keeps the codebase extensible without turning the scanner into one giant linear loop of checks.

## Current rules

### Comments

- `comments.placeholder-comments`

### Defensive noise

- `defensive.async-noise`
- `defensive.needless-try-catch`

### Structure

- `structure.pass-through-wrappers`
- `structure.barrel-density`
- `structure.over-fragmentation`
- `structure.directory-fanout-hotspot`

### Tests

- `tests.duplicate-mock-setup`

## Output shape

The CLI currently reports:

- raw counts
- physical LOC, logical LOC, and function counts
- normalized metrics:
  - score / file
  - score / KLOC (logical)
  - score / function
  - findings / file
  - findings / KLOC (logical)
  - findings / function
- file hotspots
- directory hotspots
- detailed findings in JSON mode

## Config

The analyzer reads `repo-slop.config.json` from the scan root.

Current config support:

- `ignores` — active
- `rules.<id>.enabled` — active
- `rules.<id>.weight` — active
- `thresholds` — reserved for upcoming rules

Example:

```json
{
  "ignores": ["dist/**", "coverage/**", "**/*.generated.ts"],
  "rules": {
    "structure.over-fragmentation": { "enabled": true, "weight": 1.2 },
    "comments.placeholder-comments": { "enabled": false }
  },
  "thresholds": {
    "tinyFileLoc": 20
  }
}
```

## Repository layout

```txt
src/
  core/
  discovery/
  facts/
  languages/
  reporters/
  rules/
tests/
  fixtures/
```

## Next likely steps

- richer TypeScript-aware rules
- repo-relative style outliers
- duplicate function/branch detection
- config-driven thresholds and rule weighting
- better JSON schema versioning
- PR / changed-files mode
