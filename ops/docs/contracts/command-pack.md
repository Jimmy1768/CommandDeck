# Command-Pack Contract

A command pack declares commands that CommandDeck may classify, evaluate,
route, and record. It does not grant execution by itself.

Pack manifests use the filename extension `.cdeck-pack.json`, where `cdeck`
means CommandDeck. User-facing selectors should filter for `*.cdeck-pack.json`
and pass the selected manifest path into local validation.

CommandDeck core and command packs are complementary, not competing models:

- core owns generic, reusable platform actions and engine policy;
- packs own workspace-specific routines for a company, partner, or user.

Command packs and scripts live outside this repository unless they are generic
examples or tests. They belong in declared owner repos or configured local
folders. For SourceGrid, that owner repo is `sourcegrid-labs`. Another user
might create a personal repo such as `jimmys-assistant` and put their local
workspace scripts there. Partner command packs belong in partner repos or
configured local folders.

The source-of-truth split is:

- CommandDeck-owned core packs live in this repository and are updated by
  CommandDeck maintainers.
- Custom packs live in the user's or company's own git repo or local control
  folder and are selected through configured `command_pack_roots`.

Custom pack repos use this standard V1 layout:

```text
command-packs/
  <pack_slug>/
    <pack_slug>.cdeck-pack.json
    README.md
    fixtures/
    scripts/
```

The manifest is the selected artifact. Other files in the folder do not grant
execution authority by themselves.

## Custom Pack Capability Boundary

Custom packs are deny-by-default. They may declare workspace-specific intents,
targets, required slots, examples, aliases, approved routes, and risk metadata.
They do not grant execution authority by themselves.

The enforcement chain is:

```text
schema -> capability registry -> risk policy -> approval check -> runner validation -> audit log
```

If a pack violates the contract, CommandDeck must fail closed:

- bad pack shape rejects the pack load;
- bad command declaration rejects command registration;
- unsafe runtime request is blocked before side effects;
- risky but allowed request requires explicit approval;
- rejected commands do not fall back to arbitrary execution.

Users may keep scripts in `scripts/`, but CommandDeck does not run them unless a
future explicit runner policy allows the route and the structured request passes
validation. AppRelay output must also resolve back into the same structured
contract before execution.

Command packs should model workspace routines that go beyond generic computer
control. For coding work, they may prepare the PC environment around Codex, but
they should not turn CommandDeck into a replacement coding agent.

Simple deterministic routines should declare local routes and avoid AppRelay.
SourceGrid credits are required only for AppRelay or other SourceGrid-billed
runtime routes, not for exact local scripts or read-only local checks.

## Route Families

CommandDeck routes by capability, not by product dependency. A custom pack does
not automatically require OperatorKit.

V1 route families:

- `core.local`: built-in computer/platform actions.
- `pack.local_read`: custom-pack read/status/query/draft commands.
- `pack.local_write_approved`: deterministic custom-pack writes after explicit
  approval.
- `apprelay.reasoning`: ambiguity resolution, summarization, generation, or
  other LLM-mediated work.
- `operatorkit.workflow`: workflow coordination, staged automation, heartbeat,
  handoff, and accountability.

If a command uses an optional route dependency that is not configured,
CommandDeck must return a blocked setup response and must not fall back to shell
execution.

When the route family is `apprelay.reasoning`, CommandDeck calls AppRelay as an
SourceGrid runtime client for command routing reasoning. AppRelay may clarify or map
intent, but CommandDeck must revalidate the returned structure before routing.

The concrete V1 route for `pack.local_write_approved` is
`local.pack_write_approved`. It is contract-only and must remain blocked until a
future pack-write policy defines execution, environment, approval, and audit
requirements.

Pack routines are often best understood as "use the computer to automate work
that used to require mouse and keyboard outside Codex." That is broader than
generic built-in computer control, but still narrower than becoming the coding
interface itself.

## Required Fields

- `schema_version`: contract version, currently `0.1`.
- `pack_id`: stable identifier.
- `owner`: company, user, or partner owner.
- `commands`: list of command definitions.
- `permissions`: permission policy references.
- `record_policy`: expected record destination and retention intent.
- optional `action_requirements`: pack-level required-slot rules for
  pack-specific actions.

Each command requires:

- `command_id`;
- `title`;
- `example_utterances`;
- `permission_level`;
- `route`;
- `allowed_effects`;
- `forbidden_effects`;
- `sources`;
- `runner_action` when the command uses the built-in exact local runner;
- `approval_prompt` when permission is `approval-required`.

Optional command-owned fields:

- `aliases`: deterministic phrase shortcuts for the same declared command.

## Alias Policy

Aliases are a V1 command grammar feature, not chatbot understanding.

A command-owned alias is an additional phrase that resolves to the same command
contract as its examples. It does not hide a different action, change
permission level, bypass required slots, or grant script execution.

The V1 matching chain is:

```text
user phrase -> normalized phrase -> example_utterance or alias -> command contract
```

Matching is deterministic. CommandDeck lowercases, removes punctuation, removes
simple capture filler such as `uh` or `um`, removes leading `please`, collapses
spaces, and compares strings. It does not use semantic similarity, embeddings,
or LLM paraphrase matching in the fast lane.

Aliases are scoped to the active command pack. A pack must not declare the same
normalized phrase for two commands. If two commands need the same shorthand,
the pack author should remove that alias and let CommandDeck ask a
concept-checking question from the action/slot contract instead.

Good V1 aliases:

- `puma status` for the command `local.puma_status`;
- `check sidekiq` for the command `local.sidekiq_status`;
- `open current repo` for the approval-gated command
  `local.open_commanddeck_repo`.

Bad V1 aliases:

- `check server` when both Puma and Sidekiq exist;
- `start worker` for a status-only command;
- `deploy prod` for a command that is not explicitly a deploy command.

## Action Requirements

CommandDeck core owns the shared action requirements schema. Core actions use
`contracts/commands/core-action-requirements.json`.

Packs may declare pack-level requirements for pack-specific actions, but they
must follow the shared schema in
`contracts/commands/action-requirements.schema.json`.

Action requirements define:

- required slots;
- optional slots;
- conditionally required slots;
- allowed target kinds;
- defaulting rules;
- risk tier;
- whether approval may be required;
- the concept-checking question to ask when required information is missing.

If an action is missing a required slot, or a conditional slot cannot be safely
defaulted from active context, CommandDeck should ask the concept-checking
question instead of guessing.

Pack action requirements are clarification metadata only. They are loaded only
from the active command pack, they do not create global grammar, and they do not
grant execution authority.

After a pack CCQ resume, the merged command must still resolve to an allowed
command in the active pack. If it does not resolve, CommandDeck must fail closed
or ask another CCQ.

## Sources

- Fixture-backed commands use repo-relative sources under `evals/fixtures/`.
- Built-in exact local runner commands use `local://` descriptors, for example
  `local://git/status` or `local://process/puma`.

## Allowed Effects

Slice 1 fixture packs may use:

- `read_local_fixture`;
- `draft_local_artifact`;
- `create_action_record_fixture`.

The exact local preview pack may also use:

- `read_local_state`;
- `run_allowlisted_local_command`.

Approval-gated local preview packs may also use:

- `request_human_approval`;
- `run_allowlisted_local_command_after_approval`.

All other effects must be represented as `blocked`, `contract_only`, or
`future_phase`.

## Exact Local Runner Preview

`contracts/commands/local-exact-commands.cdeck-pack.json` shows the first
built-in exact local runner path. These commands stay read-only, route through
`local.exact_read`, and reference a `runner_action` key rather than a shell
script path.

The allowlist is owned by CommandDeck core, not by the command pack. Command
packs must not embed shell, executable, or handler fields.

## Rejection Output

When CommandDeck rejects a pack command, it should return a useful failure
instead of silently ignoring the command or trying a fallback execution path.

The rejection should include:

- a short user-facing message for the current surface;
- a developer diagnostic with pack, command, field, value, and violated rule;
- no execution;
- an audit event named `pack_command_rejected`.

Local audit writes are opt-in. Use `--write-audit` to write a rejection event
under `.commanddeck/audit/pack-rejections/`. The event shape is defined in
`contracts/records/pack-rejection-audit.schema.json`.

## Core Versus Pack

Good candidates for core:

- open/play/pause/stop style actions;
- generic app or URL opens;
- generic repo and process status checks;
- reusable device or desktop primitives for the current platform target.

Good candidates for packs:

- SourceGrid workspace routines;
- user-specific dashboards and work modes;
- repo-specific service orchestration;
- personalized operating scripts and company-specific workflow automation.

## Pack Locations

`contracts/commands/mvp-commands.cdeck-pack.json` is the built-in MVP fixture pack.
`contracts/commands/local-exact-commands.cdeck-pack.json` is the built-in exact local
preview pack.
`contracts/commands/local-approved-commands.cdeck-pack.json` is the built-in
approval-gated local control preview pack.
`evals/fixtures/command-packs/` contains generic validation fixtures only.

Real owner-specific packs and scripts must stay in their owner repo or
configured local command folder. CommandDeck should load those packs through
configuration in a future phase; it should not absorb SourceGrid, personal
assistant, or partner command scripts.
