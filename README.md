# CommandDeck

CommandDeck is a local-first workspace command shell prototype. It connects
platform invocation adapters, starting with Siri and Apple Shortcuts, to
permissioned command packs that assist a user's command flow on the PC command
runner.
For SourceGrid, the first command runner is the user's Apple PC.

The core use case is hands-off workspace control: start work modes, inspect
local service state, open apps, switch devices, play media, prepare drafts, and
run approved local routines. Phones, watches, glasses, and computers can be
capture surfaces, but they never bypass the PC runner. CommandDeck is not a
replacement for Codex and is not the path for voice-driven code editing.

This repository is the `CommandDeck` skeleton only. It is a core SourceGrid
tool, sibling to OperatorKit and ManyMind. It is not AppRelay,
OperatorKit, ManyMind, or a Golden Template app repo.

## Mental Model

CommandDeck has two capability sources:

- `core`: generic built-in actions and runner behavior owned by CommandDeck;
- `pack`: company-specific or user-specific commands owned by the attached
  workspace repo or local command folder.

That split is separate from execution mode:

- exact/local/deterministic commands run through local runner boundaries;
- capable commands use AppRelay when reasoning, ambiguity handling,
  summarization, or generation is needed.

So a command can be:

- core + exact/local;
- pack + exact/local;
- core + AppRelay-mediated in a future phase;
- pack + AppRelay-mediated in a future phase.

The first platform target is Apple-first because Siri and Shortcuts provide a
thin invocation layer with minimal new infrastructure. That lets CommandDeck
ship a default built-in action set for Apple PCs before expanding to other
capture surfaces or platform adapters.

For the user-facing explanation of how CommandDeck decides whether it
understands a command, when it asks a checking question, and how saved memory
works, see [Understanding And Memory](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/understanding-and-memory.md:1).
The machine-readable counterparts are [Resolved Intent Contract](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/resolved-intent.md:1) and [Learned Memory Item Contract](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/learned-memory-item.md:1).
For deterministic memory matching, see [Normalized Phrase Contract](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/normalized-phrase.md:1).

## Product Boundary

CommandDeck owns:

- command intake from thin adapters such as Siri/Shortcuts;
- generic built-in local actions that are reusable across users on the current
  platform target;
- SourceGrid attachment status for identity, entitlement, and AppRelay billing
  readiness;
- actor identity and server-side permission checks;
- command classification and conservative route selection;
- route-family based optional dependencies;
- local workspace command flow around the PC command runner;
- read-only answers and draft-only artifacts in the local prototype;
- approval prompts for risky actions in future phases;
- action record contracts and eval fixtures.

CommandDeck does not own company-specific or personal workspace scripts.
CommandDeck attaches to a SourceGrid workspace for identity, entitlement,
payment-method readiness, and AppRelay billing policy. SourceGrid command packs
and scripts belong in `sourcegrid-labs`. Other users can attach CommandDeck
through their SourceGrid account and then reference their own assistant repos as
command-pack sources. Partner scripts belong in partner repos or configured
local command folders.

Code editing remains a PC development workflow inside Codex and the normal repo
toolchain. If a command changes code, the user should be at the command runner
with local services such as Puma, Sidekiq, databases, simulators, and browser
state available.

Voice platforms such as Siri/Shortcuts and future Google voice adapters are
input/output surfaces, not the reasoning layer. They can capture commands and
speak or play responses. CommandDeck owns permissions, routing, and records;
AppRelay owns LLM/runtime capability when model reasoning or future generated
audio is needed.

SourceGrid credits gate only SourceGrid-billed runtime paths such as AppRelay
reasoning or future AppRelay audio. Credit exhaustion must not disable Siri or
Google voice capture, platform TTS, exact local commands, local reads,
draft-only local work, or permitted local scripts.

The first invocation grammar is:

```text
Hey Siri, <device code> <action> <object> [context] [end code]
```

Example:

```text
Hey Siri, computer open ops dashboard activate
```

`Hey Siri` is owned by Apple. The device code, action, object, context, and end
code are owned by CommandDeck and the declared command pack. The preferred V1
device code is `computer`, which maps to the locked-down local PC runner
`target_runner: "command"`. Request payloads still use generic capture surfaces
such as `phone`, `watch`, `glasses`, or `computer` rather than iPhone, Android,
or MacBook-specific names. If the spoken command omits a field required for the
requested action, CommandDeck should ask a concept-checking question instead of
guessing.

In product terms, CommandDeck is not just "control the computer." It uses the
computer as the execution surface for both generic built-in actions and
workspace-specific automation that previously required mouse and keyboard work
outside Codex.

## Current Slice

The default path remains the slice 1 deterministic skeleton. It defines docs,
contracts, fixtures, and deterministic validation.

This repo now also includes a slice 2 preview path for exact local read-only
commands. That preview uses a separate command pack and a built-in allowlisted
runner boundary for safe local checks such as repo status, recent commits,
Puma status, and Sidekiq status.

It also includes an approval-gated local control preview. That path creates an
action record and approval request first, then executes only after a separate
approval decision is applied.

Allowed in this slice:

- read-only fixtures;
- draft-only fixtures;
- exact local read-only commands through allowlisted runner actions;
- approval-gated local GUI actions through allowlisted runner actions;
- contract documentation;
- local validation tests.

Not allowed in this slice:

- provider keys, secrets, or environment values;
- raw payment method details, card data, or provider payment tokens;
- production deploy, payment, infrastructure, customer-data, or secrets
  mutation;
- calls to AppRelay, OperatorKit, or ManyMind;
- arbitrary local shell execution from command packs;
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

Preview an exact local read-only command through the allowlisted runner:

```sh
npm run command:local -- --command-pack contracts/commands/local-exact-commands.cdeck-pack.json "What is the status of this repo?"
```

Other built-in exact local preview commands:

```sh
npm run command:local -- --command-pack contracts/commands/local-exact-commands.cdeck-pack.json "Show recent commits."
npm run command:local -- --command-pack contracts/commands/local-exact-commands.cdeck-pack.json "Is Puma running?"
npm run command:local -- --command-pack contracts/commands/local-exact-commands.cdeck-pack.json "Is Sidekiq running?"
```

Preview an approval-gated local control command:

```sh
npm run command:local -- --command-pack contracts/commands/local-approved-commands.cdeck-pack.json "Open the SourceGrid dashboard."
```

Apply a separate approval decision to an approval-required action record:

```sh
npm run command:local -- approval:apply --record-file records/actions/rec_example.json --decision-file evals/fixtures/approval_decisions/operatorkit_dry_run.denied.json
```

Resume a concept-checking question from a saved action record:

```sh
npm run command:local -- ccq:resume --record-file records/actions/rec_example.json --resume-token ccq_example --command-pack contracts/commands/local-approved-commands.cdeck-pack.json "SourceGrid dashboard"
```

Select a CommandDeck-owned repo-relative command pack explicitly:

```sh
npm run command:local -- --command-pack contracts/commands/mvp-commands.cdeck-pack.json "What is my next SourceGrid task?"
```

The MVP pack remains contract-only. Loaded packs cannot include executable
fields, external integrations, or sources outside `evals/fixtures/` in slice 1.
The exact-local preview pack may use `runner_action` keys that map to
CommandDeck-owned allowlisted local commands, plus `local://` source
descriptors.
The approval-gated local preview pack uses the same built-in runner boundary,
but approval-required commands stay pending until a human decision is applied.
Generic example packs live under `evals/fixtures/command-packs/`; real
SourceGrid packs belong in `sourcegrid-labs` or configured local command
folders.
Pack discovery configuration is metadata-only in this slice and cannot crawl
owner repos, execute scripts, call providers, or enable `execute-now`.
Custom packs should live in the user's or company's own git repo. CommandDeck
may load them only through a configured local-only control folder and a validated
`*.cdeck-pack.json` selection manifest. `cdeck` means CommandDeck.

Create a starter custom pack layout:

```sh
npm run command:local -- pack:init --control-root /path/to/owner-repo --pack-slug sourcegrid --owner sourcegrid
```

Run with an explicit local config:

```sh
npm run command:local -- --config commanddeck.config.example.json "What is my next SourceGrid task?"
```

Config files are repo-relative and cannot enable record writes by default.
Configured local-folder roots may point outside this repo only when marked
`local_only: true`.

Check SourceGrid attachment and AppRelay billing readiness:

```sh
npm run command:local -- sourcegrid:status --config commanddeck.config.example.json
```

This is contract-only in slice 1. It validates local attachment metadata and
reports payment-method readiness without calling SourceGrid, AppRelay, Stripe,
or any external service.

Preview the contract-only SourceGrid AppRelay proxy request shape without
sending a network call:

```sh
npm run command:local -- sourcegrid:apprelay-proxy-preview --config commanddeck.config.example.json --request-file evals/fixtures/adapter_requests/apple_shortcuts.next_task.json
```

The AppRelay fixture command also exercises this shape as a smoke path while
still answering from local fixture data:

```sh
npm run command:local -- --config commanddeck.config.example.json "What changed in AppRelay today?"
```

If SourceGrid credits are unavailable, CommandDeck should degrade gracefully:
fixed local commands can still run, while AppRelay reasoning routes return a
clear no-credits/no-spend response.

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

Write a local custom-pack rejection audit explicitly:

```sh
npm run command:local -- pack:open --command-pack path/to/custom.cdeck-pack.json --write-audit
```

Generated audit JSON files are written under `.commanddeck/audit/pack-rejections/`
and ignored by git.

## Repository Shape

```text
bin/                    Local CLI wrapper for the shell core
commanddeck.config.example.json  Safe local config example
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
repo-local to their owner, attached through SourceGrid identity and billing, and
routed through the contracts defined here. CommandDeck does not require
OperatorKit globally; OperatorKit is needed only for `operatorkit.workflow`
routes. Local core and custom-pack routes remain available without OperatorKit
when policy allows them. The custom-pack write route
`local.pack_write_approved` is contract-only until a future write policy exists.
