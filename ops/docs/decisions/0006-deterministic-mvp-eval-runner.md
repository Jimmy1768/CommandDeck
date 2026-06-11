# 0006: Deterministic MVP Eval Runner

Status: Accepted for Phase 1 prototype.

## Context

CommandKit needs a repeatable way to prove that command contracts, local shell
classification, permission levels, route selection, and fixture-backed results
stay aligned.

## Decision

Add a deterministic eval runner for `evals/cases/mvp.slice1.cases.json`.

Default behavior:

```sh
npm run eval:mvp
```

The runner executes each case through the local shell and compares:

- command id;
- permission level;
- route;
- approval status;
- result status.

It prints JSON to stdout by default. Report persistence is opt-in with
`--write-report`, and generated JSON reports are ignored by git.

Add a separate safety suite:

```sh
npm run eval:safety
```

Safety cases verify that unsupported high-risk commands fail closed in slice 1.

## Consequences

- MVP behavior can be checked without adding integrations.
- Evals become a normal local verification step alongside tests.
- Future cases can expand coverage before real execution is added.

## Non-Goals

- No model grading.
- No external systems.
- No automatic record writes.
- No benchmark claims.
