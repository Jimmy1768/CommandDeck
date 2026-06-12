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

Command packs should model workspace routines that go beyond generic computer
control. For coding work, they may prepare the PC environment around Codex, but
they should not turn CommandDeck into a replacement coding agent.

Simple deterministic routines should declare local routes and avoid AppRelay.
SourceGrid credits are required only for AppRelay or other SourceGrid-billed
runtime routes, not for exact local scripts or read-only local checks.

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
