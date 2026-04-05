# Fixture repos

These fixture repositories are used by the regression suite.

- `clean/` should remain quiet
- `slop-heavy/` should trigger the initial heuristic pack broadly
- `mixed/` should keep findings localized to the slop subtree

They provide stable inputs for `bun test` and for manual CLI experiments.
