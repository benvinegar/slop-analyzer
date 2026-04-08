# slop-analyzer

A deterministic Bun + TypeScript CLI for finding **AI-associated slop patterns** in a repository.

## Positioning

This project should answer:
- where the slop hotspots are;
- which heuristics triggered;
- how strongly each file or directory exhibits AI-associated slop patterns.

It should **not** claim certainty about code authorship.

## Architecture goal

The engine must be **pluggable**.
New capabilities should be added as modules:
- language plugins
- fact providers
- rule plugins
- reporters

Not as one long linear loop of checks.

## Initial phases

1. **Phase 1 — Scaffold**
   - Bun + TypeScript project setup
   - config loading
   - CLI shell
   - smoke tests

2. **Phase 2 — Pluggable engine**
   - plugin interfaces
   - registry + scheduler
   - discovery + reporting
   - engine tests

3. **Phase 3 — First heuristic pack**
   - structure: over-fragmentation, barrel density, pass-through wrappers, directory fan-out hotspot
   - defensive: needless try/catch, async noise
   - comments: placeholder comments

4. **Phase 4 — Regression suite + docs**
   - fixture repos
   - end-to-end tests
   - README and usage docs

## v1 heuristics

### Structure
- over-fragmentation
- barrel density
- pass-through wrappers
- directory fan-out hotspot

### Defensive noise
- needless try/catch
- async noise

### Comments
- placeholder comments

## Success criteria

- deterministic output
- explainable findings with evidence
- test suite that runs heuristics against fixture repos
- per-phase commits to keep the build incremental
