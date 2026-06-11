# Local Prototype Runbook

This runbook covers the slice 1 skeleton only.

## Validate Contracts And Fixtures

```sh
npm test
```

The test suite checks that MVP cases and fixtures remain contract-only, that
execute-now is disabled, and that approval-required commands do not claim to
execute.

## Add A Fixture

1. Add a command case under `evals/cases/`.
2. Add its input and expected output under `evals/fixtures/`.
3. Keep allowed effects to read-only or draft-only values.
4. Run `npm test`.

## Run A Local Command

```sh
npm run command:local -- "What is my next SourceGrid task?"
```

The command reads contract and fixture JSON, then prints a response and action
record shape to stdout. It does not write records, call external systems, or
execute commands.

## Write A Local Action Record

```sh
npm run command:local -- --write-record "What is my next SourceGrid task?"
```

Record writes are opt-in and stay under `records/actions/` by default.
Generated record JSON files are ignored by git. This is still an action record
only; it is not an execution record and it does not trigger any integration.

## Stop Conditions

Stop and add a decision record before adding any code path that calls an
external runtime, writes records outside fixtures, or runs local scripts.
