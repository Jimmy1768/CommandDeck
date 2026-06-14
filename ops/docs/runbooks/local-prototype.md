# Local Prototype Runbook

This runbook covers the deterministic local prototype, the built-in core pack,
and the legacy fixture packs used by evals/compatibility tests.

CommandDeck is for hands-off workspace command flow around the PC command runner.
It is not a Codex replacement. If a task edits code, use Codex and the normal
local development toolchain on the PC.

For the plain-language reference on understanding, clarification, risk tiers,
and memory writes, see
[Understanding And Memory](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/understanding-and-memory.md:1).

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

## Run The Local Smoke Gate

```sh
npm run smoke:local
```

The smoke gate exercises public CLI paths against the built-in core pack and a
fixture custom pack. It checks deterministic local reads, calibration/help
commands, pack open, target alias approval preview, Siri adapter request
handling, and denied approval application.

Unlike `npm run verify`, this is a local-runner smoke test. It may need normal
Mac process-list access because service status commands call the allowlisted
`ps -ef` runner path. It must not launch GUI apps: approval-gated controls are
verified through approval preview and a denied approval decision.

For the first physical voice surface, see
[Siri Shortcuts Local](/Users/jimmy1768/Projects/CommandDeck/ops/docs/runbooks/siri-shortcuts-local.md:1).

## Add A Fixture

1. Add a command case under `evals/cases/`.
2. Add its input and expected output under `evals/fixtures/`.
3. Keep allowed effects to read-only or draft-only values.
4. Run `npm test`.

## Run A Core Local Command

```sh
npm run command:local -- "Git status."
```

The command reads the built-in core pack, then prints a response and action
record shape to stdout. Read-only core commands may execute deterministic local
reads. They do not write records unless `--write-record` is supplied.

## Run A Core Approval-Gated Control Command

```sh
npm run command:local -- "Open the SourceGrid dashboard."
```

This returns an action record with `approval_status: requested_pending`. To
apply a separate human decision:

```sh
npm run command:local -- approval:apply --record-file records/actions/rec_example.json --decision-file path/to/decision.json
```

If the approved record uses a built-in allowlisted local control route,
CommandDeck may execute it at this step.

## Built-In Core Commands

The default pack is
`contracts/commands/core-commands.cdeck-pack.json`. It uses
CommandDeck-owned `runner_action` keys, not shell in the pack. V1 core includes
read-only commands such as:

- `What is the status of this repo?`
- `Show recent commits.`
- `Is Puma running?`
- `Is Sidekiq running?`

It also includes approval-gated GUI controls such as opening the SourceGrid
dashboard or the CommandDeck repo.

## Resume A Concept-Checking Question

If a deterministic local command is missing a required object, CommandDeck can
return a concept-checking question:

```sh
npm run command:local -- --write-record "Computer open activate"
```

Use the returned `record_write.record_path` and
`record.result.clarification.resume_token` to resume:

```sh
npm run command:local -- ccq:resume --record-file records/actions/rec_example.json --resume-token ccq_example "SourceGrid dashboard"
```

The resume path fills missing slots only, revalidates the command, and preserves
existing approval gates. It does not call AppRelay or treat the follow-up as
approval.

When `--write-record` is used, `ccq:resume` updates the original CCQ action
record under a local lock before writing the resumed command record.
Fresh locks fail safely. Locks older than 30 seconds are treated as stale and
only the `.lock` file may be removed.

## Select A Legacy Fixture Pack

```sh
npm run command:local -- --command-pack contracts/commands/mvp-commands.cdeck-pack.json "What is my next SourceGrid task?"
```

Direct `--command-pack` paths must be repo-relative. The MVP pack is now a
legacy fixture/eval pack, not the default runtime pack. The local-exact and
local-approved packs remain compatibility fixtures for pack-loading tests.

Custom packs outside this repo must be selected through a configured
`local-folder` root with `local_only: true`, not by passing arbitrary absolute
paths to `--command-pack`.

## Use Local Config

```sh
npm run command:local -- --config commanddeck.config.example.json "Git status."
```

If `commanddeck.config.json` is absent, CommandDeck uses safe built-in defaults.
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

CCQ state also belongs in local action records. A clarification record stores
the partial intent, missing slots, resume token, expiry, and token status so a
follow-up can resume across separate Siri/Shortcuts or CLI invocations. This is
auditable local state only; it is not durable memory, a task queue, or approval.
Deterministic core CCQs use `contracts/commands/core-action-requirements.json`
as their runtime source of truth.
Resume token consumption must be atomic: only `active -> used`,
`active -> expired`, or `active -> rejected` may succeed.

Expired or terminal CCQ records may be manually pruned after 7 days. Do not add
automatic cleanup in V1, and do not treat cleanup as learned-memory pruning.

## Stop Conditions

Stop and add a decision record before adding any code path that calls an
external runtime, writes records outside fixtures, or runs local scripts.
Also stop before adding any flow that treats Siri, Shortcuts, or Google voice
as a coding interface instead of a command invocation surface.
