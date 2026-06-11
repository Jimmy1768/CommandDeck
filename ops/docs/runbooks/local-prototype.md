# Local Prototype Runbook

This runbook covers the slice 1 skeleton only.

## Validate Contracts And Fixtures

```sh
npm test
```

The test suite checks that MVP cases and fixtures remain contract-only, that
execute-now is disabled, and that approval-required commands do not claim to
execute.

Run the full local verification gate:

```sh
npm run verify
```

This runs tests, fixture validation, MVP evals, and safety evals.

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

## Select A Command Pack

```sh
npm run command:local -- --command-pack contracts/commands/mvp-commands.json "What is my next SourceGrid task?"
```

Command-pack paths must be repo-relative. Phase 1 packs may classify commands
and read fixtures only.

## Use Local Config

```sh
npm run command:local -- --config commandkit.config.example.json "What is my next SourceGrid task?"
```

If `commandkit.config.json` is absent, CommandKit uses safe built-in defaults.
Config cannot enable record writes by default in Phase 1.

## Use An Adapter Request File

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/apple_shortcuts.next_task.json
```

Request files use the Siri/Shortcuts adapter shape without creating a server
endpoint or real platform integration.

## Run MVP Evals

```sh
npm run eval:mvp
```

The eval runner prints a JSON report by default. To persist a generated report:

```sh
npm run eval:mvp -- --write-report --report evals/reports/mvp.slice1.latest.json --overwrite
```

Generated JSON reports are ignored by git.

## Run Safety Evals

```sh
npm run eval:safety
```

Safety evals cover high-risk unsupported commands such as production deploy,
payment, automation pause, and public-message requests. They must fail closed.

## Run Approval Evals

```sh
npm run eval:approval
```

Approval evals cover denied, approved, and expired decision fixtures. Even an
approved decision must not execute anything in Phase 1.

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
