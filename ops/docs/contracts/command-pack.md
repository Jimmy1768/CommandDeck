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
- Calibration/help commands are built into CommandDeck core and are available
  before active-pack classification.

Custom pack repos use this standard layout:

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
- `pack_release`: pack behavior release in `release-X.Y.Z` format.
- `pack_scope`: pack ownership/scope class.
- `commanddeck_release_compatibility`: compatible CommandDeck product release
  range.
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
- `target_match`: core-owned metadata that lets a command consume active-pack
  target aliases as object slots.

Optional pack-owned fields:

- `action_requirements`: slot and CCQ metadata for pack-specific actions;
- `targets`: voice-friendly named objects such as URLs, dashboards, repos,
  services, apps, and short-lived working bookmarks;
- `default_environment`: an explicit default such as `dev` or `prod` for safe
  target disambiguation.

## Release Identity

CommandDeck uses three separate version concepts:

- `release-X.Y.Z`: CommandDeck product release, for example
  `release-0.1.0`.
- `schema_version`: manifest contract compatibility, currently `0.1`.
- `pack_release`: independent pack behavior release, also in
  `release-X.Y.Z` format.

Pack releases matter because packs define operational behavior. A pack can
change faster or slower than CommandDeck itself, and a custom pack may need to
pin compatibility before it is trusted for voice-driven local work.

Every pack must declare:

```json
{
  "pack_release": "release-0.1.0",
  "pack_scope": "user_custom",
  "commanddeck_release_compatibility": {
    "min": "release-0.1.0",
    "max_exclusive": "release-1.0.0"
  }
}
```

CommandDeck enforces the compatibility range as:

```text
min <= current CommandDeck release < max_exclusive
```

If the current CommandDeck release is outside the range, CommandDeck rejects
the pack before command classification or execution. It should show a setup
message with the current release, the pack range, and the pack id/release when
available. It must not auto-migrate or silently run an incompatible pack.

Allowed `pack_scope` values:

- `commanddeck_core`: built-in CommandDeck core pack maintained in this repo.
- `sourcegrid_company`: SourceGrid Labs company-published pack for the hosted
  tool or company-wide SourceGrid routines.
- `user_custom`: a user/customer/Jimmy-authored workspace pack, even if the
  file lives inside `sourcegrid-labs`.
- `partner_custom`: partner-authored pack in a partner repo or local control
  folder.
- `fixture_legacy`: repo fixtures and historical eval packs only.

Do not use `sourcegrid` as an overloaded scope. If SourceGrid Labs publishes a
company pack, use `sourcegrid_company`. If Jimmy authors a personal/custom pack
inside the `sourcegrid-labs` repo, use `user_custom`.

## Core Pack As Versioned API

The core pack is not just a default manifest. It is a behavior API that custom
packs may depend on.

Custom packs can piggyback on core-owned behavior such as:

- `open` and other generic platform actions;
- target alias resolution into core action object slots;
- approval-gated local runner semantics;
- route-family boundaries;
- concept-checking question behavior for missing required slots.

Because of that dependency, CommandDeck must not silently remove or redefine
core behavior inside a compatible release range. Treat it like `api/v1` and
`api/v2`:

- additive core actions are acceptable when they do not change existing
  behavior;
- incompatible behavior changes require a release boundary;
- legacy behavior should be preserved when possible;
- if a pack requires unsupported legacy behavior, CommandDeck should reject the
  pack with a compatibility/setup message instead of running it incorrectly.

## Calibration Commands

Calibration/help commands are not custom-pack commands. They are built-in,
read-only CommandDeck commands for discovery and usage help.

They may use relaxed deterministic phrases such as:

- `help`;
- `what can you do`;
- `what commands can you understand`;
- `show commands`;
- `command structure`;
- `active pack`;
- `siri setup`.

They may open or print CommandDeck-owned help docs and summarize declared
active-pack metadata. They must not execute workspace actions, run custom-pack
scripts, mutate settings, approve anything, call AppRelay, or make external
network calls.

Reference:

- [Calibration Commands](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/calibration-commands.md:1)

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

## Target Registry

Voice is good at selecting named things. It is bad at transmitting exact URLs,
repo paths, service identifiers, app bundle names, or dashboard routes.

Command packs should therefore model reusable objects as named targets rather
than requiring one script or one command per webpage.

The V1 runtime can resolve active-pack target aliases for core target-aware
actions. This means a custom pack can declare targets such as homepages or
working bookmarks without declaring a separate command for every webpage.

The active custom pack is still singular. CommandDeck core is always available
as the built-in action layer, so the runtime model is:

```text
one active owner/custom pack + built-in CommandDeck core actions
```

A V1 target should have:

- `target_id`: stable namespaced id, for example
  `sourcecombatives.homepage`;
- `kind`: `url`, `dashboard`, `repo`, `service`, `app`, `media`, or another
  allowed target kind;
- `display_name`: user-facing label;
- `aliases`: voice-friendly names;
- `environment`: `dev`, `prod`, or another explicitly supported environment
  when the target value is environment-specific;
- `value`: the concrete URL, path, service name, or app identifier;
- optional `bookmark`: true when the target is part of the user's current
  working set instead of a permanent project surface.

Example:

```json
{
  "target_id": "sourcecombatives.homepage.prod",
  "kind": "url",
  "display_name": "Source Combatives homepage",
  "aliases": ["source combatives", "source combatives homepage"],
  "environment": "prod",
  "value": "https://sourcecombatives.com"
}
```

The matching chain for target-based commands is:

```text
spoken action -> core command grammar
spoken object -> active-pack target alias
core runner -> concrete target value
```

Example:

```text
open source combatives homepage
```

resolves to:

```text
action = core.open
target = sourcecombatives.homepage.prod
runner = core open-url behavior
```

The target itself does not execute. It only fills the object slot. If the user
says only `source combatives homepage`, CommandDeck should ask what to do with
that target unless a separate explicit default-action rule exists.

Target-only packs are valid when they declare safe structured targets and keep
`commands` as an empty array. This is useful for voice bookmarks:

```json
{
  "schema_version": "0.1",
  "pack_id": "sourcecombatives.targets.v1",
  "pack_release": "release-0.1.0",
  "pack_scope": "user_custom",
  "commanddeck_release_compatibility": {
    "min": "release-0.1.0",
    "max_exclusive": "release-1.0.0"
  },
  "owner": "sourcecombatives",
  "permissions": "contracts/permissions/permission-levels.json",
  "record_policy": {
    "record_schema": "contracts/records/action-record.schema.json",
    "storage": "opt_in_local_action_record"
  },
  "default_environment": "prod",
  "targets": [
    {
      "target_id": "sourcecombatives.homepage.dev",
      "kind": "url",
      "display_name": "Source Combatives local homepage",
      "aliases": ["source combatives", "local source combatives"],
      "environment": "dev",
      "value": "http://localhost:3000/"
    },
    {
      "target_id": "sourcecombatives.homepage.prod",
      "kind": "url",
      "display_name": "Source Combatives homepage",
      "aliases": ["source combatives", "source combatives homepage"],
      "environment": "prod",
      "value": "https://sourcecombatives.com/"
    }
  ],
  "commands": []
}
```

Then the spoken command:

```text
computer open source combatives homepage activate
```

resolves through the core `open` action to `workspace.open_url`, requests
approval, and only opens the URL after approval.

### Target Ambiguity

Duplicate target aliases are rejected by default.

The V1 exception is a dev/prod pair for the same logical target family. The
pack must declare `default_environment`, and runtime defaulting is allowed only
for safe target-aware core commands such as approval-gated URL/dashboard opens.

For example, both of these targets may use alias `source combatives`:

- `sourcecombatives.homepage.dev`;
- `sourcecombatives.homepage.prod`.

If `default_environment` is `prod`, `open source combatives` resolves to prod.
If the user says `open local source combatives`, the explicit dev alias wins.

The exception must not be used for writes, service control, database mutation,
deploys, external effects, or other high-risk operations. Those cases must use
distinct aliases or ask a concept-checking question before routing.

If the pack has distinct dev/prod aliases and no default environment, an
underspecified family phrase may ask a runtime CCQ instead of rejecting the
pack. Example:

```text
computer open source combatives activate
```

can ask:

```text
Do you mean source combatives dev or source combatives production?
```

This CCQ path is allowed only when CommandDeck can identify one logical target
family with two to four safe choices. If the phrase could refer to unrelated
targets or too many targets, CommandDeck fails closed or asks for a more
specific command.

### Homepage Targets

Every web-backed project or company pack should be able to declare a homepage
target. Workflows often begin at the homepage or local app root, so this target
is worth modeling even when no other pages are declared.

Homepage targets should distinguish dev and production when both exist:

```json
[
  {
    "target_id": "sourcecombatives.homepage.dev",
    "kind": "url",
    "display_name": "Source Combatives local homepage",
    "aliases": ["local source combatives", "source combatives dev"],
    "environment": "dev",
    "value": "http://localhost:3000"
  },
  {
    "target_id": "sourcecombatives.homepage.prod",
    "kind": "url",
    "display_name": "Source Combatives production homepage",
    "aliases": ["source combatives", "source combatives production"],
    "environment": "prod",
    "value": "https://sourcecombatives.com"
  }
]
```

If the user says `open source combatives` and both dev and prod are valid,
CommandDeck may use the pack's declared default environment only when the risk
is acceptable. Otherwise it should ask a concept-checking question.

### Working Bookmarks

Users should not maintain a script or command for every page. For voice-driven
work, a pack may expose a small working set of bookmark targets such as:

- `webpage one`;
- `billing dashboard`;
- `admin users page`;
- `local app`;
- `production app`.

These are still targets, not scripts. Codex or another setup assistant can help
copy exact URLs into the pack or a local target registry, but CommandDeck only
consumes the resulting structured target declarations.

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

## Core Pack

`contracts/commands/core-commands.cdeck-pack.json` is the canonical built-in
core pack. It contains the generic local actions CommandDeck owns directly:
repo status, recent commits, Puma status, Sidekiq status, and approval-gated
open actions.

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

`contracts/commands/core-commands.cdeck-pack.json` is the default built-in core
pack.
`contracts/commands/mvp-commands.cdeck-pack.json` is the legacy MVP fixture and
eval pack.
`contracts/commands/local-exact-commands.cdeck-pack.json` and
`contracts/commands/local-approved-commands.cdeck-pack.json` are legacy preview
packs preserved for compatibility tests.
`evals/fixtures/command-packs/` contains generic validation fixtures only.

Real owner-specific packs and scripts must stay in their owner repo or
configured local command folder. CommandDeck should load those packs through
configuration in a future phase; it should not absorb SourceGrid, personal
assistant, or partner command scripts.
