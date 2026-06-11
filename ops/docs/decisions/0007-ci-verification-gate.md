# 0007: CI Verification Gate

Status: Accepted for Phase 1 prototype.

## Context

CommandKit now has contract validation, local shell tests, MVP evals, and safety
evals. These checks should run together locally and in GitHub before changes are
merged.

## Decision

Add one local verification command:

```sh
npm run verify
```

The command runs:

- unit and contract tests;
- fixture validation;
- MVP evals;
- safety evals.

Add GitHub Actions CI at `.github/workflows/ci.yml` to run `npm run verify` on
pushes to `main` and pull requests.

## Consequences

- The GitHub repo has a repeatable quality gate.
- CI remains dependency-free and does not need provider keys.
- CI does not call AppRelay, OperatorKit, ManyMind, or platform adapters.
- Future execution work must keep or expand this gate before it is merged.
