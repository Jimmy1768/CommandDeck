# Command-Pack Contract

A command pack declares commands that CommandKit may classify, evaluate,
route, and record. It does not grant execution by itself.

Command packs live outside this repository unless they are generic examples or
tests. SourceGrid command packs belong in `sourcegrid-labs`. Partner command
packs belong in partner repos or configured local folders.

## Required Fields

- `schema_version`: contract version, currently `0.1`.
- `pack_id`: stable identifier.
- `owner`: company, user, or partner owner.
- `commands`: list of command definitions.
- `permissions`: permission policy references.
- `record_policy`: expected record destination and retention intent.

Each command requires:

- `command_id`;
- `title`;
- `example_utterances`;
- `permission_level`;
- `route`;
- `allowed_effects`;
- `forbidden_effects`;
- `sources`;
- `approval_prompt` when permission is `approval-required`.

## Allowed Effects In Slice 1

- `read_local_fixture`;
- `draft_local_artifact`;
- `create_action_record_fixture`.

All other effects must be represented as `blocked`, `contract_only`, or
`future_phase`.

## Pack Locations

`contracts/commands/mvp-commands.json` is the built-in MVP fixture pack.
`evals/fixtures/command-packs/` contains generic validation fixtures only.

Real owner-specific packs must stay in their owner repo or configured local
command folder. CommandKit should load those packs through configuration in a
future phase; it should not absorb SourceGrid or partner command scripts.
