# CommandKit

CommandKit is a local-first workspace command shell prototype. It connects
platform invocation adapters, starting with Siri and Apple Shortcuts, to
permissioned command packs that assist a user's command flow on the PC command
runner.
For SourceGrid, the first command runner is the user's Apple PC.

The core use case is hands-off workspace control: start work modes, inspect
local service state, open apps, switch devices, play media, prepare drafts, and
run approved local routines. Phones, watches, glasses, and computers can be
capture surfaces, but they never bypass the PC runner. CommandKit is not a
replacement for Codex and is not the path for voice-driven code editing.

This repository is the `command-kit` skeleton only. It is a second-class
installable SourceGrid tool, sibling to OperatorKit. It is not AppRelay,
OperatorKit, ManyMind, or a Golden Template app repo.

## Product Boundary

CommandKit owns:

- command intake from thin adapters such as Siri/Shortcuts;
- actor identity and server-side permission checks;
- command classification and conservative route selection;
- local workspace command flow around the PC command runner;
- read-only answers and draft-only artifacts in the local prototype;
- approval prompts for risky actions in future phases;
- action record contracts and eval fixtures.

CommandKit does not own company-specific or personal workspace scripts.
SourceGrid command packs and scripts belong in `sourcegrid-labs`. Another user
can attach CommandKit to their own assistant repo, such as `jimmys-assistant`,
and keep their scripts there. Partner scripts belong in partner repos or
configured local command folders.

Code editing remains a PC development workflow inside Codex and the normal repo
toolchain. If a command changes code, the user should be at the command runner
with local services such as Puma, Sidekiq, databases, simulators, and browser
state available.

Voice platforms such as Siri/Shortcuts and future Google voice adapters are
input/output surfaces, not the reasoning layer. They can capture commands and
speak or play responses. CommandKit owns permissions, routing, and records;
AppRelay owns LLM/runtime capability when model reasoning or future generated
audio is needed.

The first invocation grammar is:

```text
Hey Siri, <device code> <command>
```

Example:

```text
Hey Siri, command play focus music
```

`Hey Siri` is owned by Apple. The device code and command are owned by
CommandKit and the attached command pack. The initial reserved device code is
`command`, which routes to the locked-down local PC runner. Request payloads use
generic capture surfaces such as `phone`, `watch`, `glasses`, or `computer`
rather than iPhone, Android, or MacBook-specific names.

## Current Slice

Implementation slice 1 is a repo skeleton. It defines docs, contracts, fixtures,
and deterministic validation only.

Allowed in this slice:

- read-only fixtures;
- draft-only fixtures;
- contract documentation;
- local validation tests.

Not allowed in this slice:

- provider keys, secrets, or environment values;
- production deploy, payment, infrastructure, customer-data, or secrets
  mutation;
- calls to AppRelay, OperatorKit, or ManyMind;
- execute-now actions;
- SourceGrid-specific command scripts copied into this repo.

## Minimal Stack

The stack is dependency-free Node.js using the built-in `node:test` runner.
Contracts and fixtures are JSON plus Markdown. There are no runtime
dependencies and no integrations.

Run validation:

```sh
npm test
```

or:

```sh
node --test test/*.test.mjs
```

Run the full verification gate:

```sh
npm run verify
```

This runs tests, fixture validation, MVP evals, and safety evals.

Run the local fixture-backed shell:

```sh
npm run command:local -- "What is my next SourceGrid task?"
```

The local shell prints a response plus an action-record-shaped JSON object. It
does not write records or call external systems.

Select a repo-relative command pack explicitly:

```sh
npm run command:local -- --command-pack contracts/commands/mvp-commands.json "What is my next SourceGrid task?"
```

Command-pack loading is contract-only. Loaded packs cannot include executable
fields, external integrations, or sources outside `evals/fixtures/` in Phase 1.
Generic example packs live under `evals/fixtures/command-packs/`; real
SourceGrid packs belong in `sourcegrid-labs` or configured local command
folders.
Pack discovery configuration is metadata-only in this slice and cannot crawl
owner repos, execute scripts, call providers, or enable `execute-now`.

Run with an explicit local config:

```sh
npm run command:local -- --config commandkit.config.example.json "What is my next SourceGrid task?"
```

Config is repo-relative and cannot enable record writes by default.

Run with a Siri/Shortcuts-shaped request fixture:

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/apple_shortcuts.next_task.json
```

Run with a Google voice-shaped request fixture:

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/google_voice.next_task.json
```

Request files are validated structured JSON. They cannot include tokens,
authorization headers, env values, provider keys, passwords, or secrets.
Command results include an `adapter_response` envelope with `display_text`,
`spoken_text`, permission status, route, and action `record_ref`. AppRelay audio
is unavailable in this slice, so voice adapters speak returned text with
platform TTS.

Run MVP evals:

```sh
npm run eval:mvp
```

The eval runner executes fixture-backed cases and compares expected route,
permission, approval, and result status. It prints by default and only writes a
JSON report with `--write-report`.

Run safety evals:

```sh
npm run eval:safety
```

Safety evals prove unsupported high-risk commands fail closed in slice 1.

Run approval decision evals:

```sh
npm run eval:approval
```

Approval evals prove denied, approved, and expired decisions never execute
actions in slice 1.

Write a local action record explicitly:

```sh
npm run command:local -- --write-record "What is my next SourceGrid task?"
```

Generated record JSON files are written under `records/actions/` and ignored by
git. Action records are not execution records.

## Repository Shape

```text
bin/                    Local CLI wrapper for the shell core
commandkit.config.example.json  Safe local config example
ops/docs/architecture/  Product and integration boundaries
ops/docs/contracts/     Adapter, command-pack, permission, and record docs
ops/docs/runbooks/      Local-only prototype operation notes
ops/docs/decisions/     Architecture decisions
packages/shell-core/    Deterministic fixture-backed local shell core
contracts/              Machine-readable command, permission, route, record contracts
evals/fixtures/         Non-executing fixture inputs and expected outcomes
evals/cases/            MVP eval case definitions
evals/reports/          Local eval notes and reports
test/                   Dependency-free contract validation
scripts/                Safe local developer helpers only
```

## Readiness

This repo is ready for SourceGrid to add command-pack definitions later, but not
ready to execute real workflows. Real command packs must remain permissioned,
repo-local to their owner, and routed through the contracts defined here.
