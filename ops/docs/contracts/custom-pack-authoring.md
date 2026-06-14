# Custom Pack Authoring Reference

This is the user-facing reference for creating CommandDeck custom packs.

## Source Of Truth

Core packs are owned by CommandDeck and live in the CommandDeck repo. Custom
packs are owned by the user, company, or partner and should live in that
owner's git repo or local control folder.

Do not copy company scripts, local env files, secrets, provider keys, or
credentials into CommandDeck core.

## Standard Layout

Use this V1 layout:

```text
<owner-control-repo>/
  command-packs/
    <pack_slug>/
      <pack_slug>.cdeck-pack.json
      README.md
      fixtures/
      scripts/
```

Rules:

- `pack_slug` is lowercase kebab-case, for example `sourcegrid` or
  `jimmy-local`.
- The selected manifest path is
  `command-packs/<pack_slug>/<pack_slug>.cdeck-pack.json`.
- `cdeck` means CommandDeck.
- SourceGrid Labs and other selector UIs should filter for
  `*.cdeck-pack.json`.

## Create A Pack

Run from the CommandDeck repo:

```sh
npm run command:local -- pack:init --control-root /path/to/owner-repo --pack-slug sourcegrid --owner sourcegrid
```

Example:

```sh
npm run command:local -- pack:init --control-root /Users/jimmy1768/Projects/sourcegrid-labs --pack-slug sourcegrid --owner sourcegrid
```

This creates:

```text
/Users/jimmy1768/Projects/sourcegrid-labs/
  command-packs/
    sourcegrid/
      sourcegrid.cdeck-pack.json
      README.md
      fixtures/
      scripts/
```

`pack:init` refuses to overwrite an existing manifest or README.

## Starter Manifest

The generated manifest is intentionally boring:

- read-only starter command;
- no secrets;
- no env;
- no shell;
- no executable handler;
- no execute-now;
- no external call authority.

Selecting a pack validates the manifest. It does not execute scripts.

## What To Edit

Edit `<pack_slug>.cdeck-pack.json` to add commands. Each command needs:

- `command_id`;
- `title`;
- `example_utterances`;
- `permission_level`;
- `route`;
- `allowed_effects`;
- `forbidden_effects`;
- `sources`.

Use pack-level `action_requirements` when a pack-specific action needs required
slots that core does not know about.

## Choose The Route Family

Custom packs do not automatically require OperatorKit. Choose the route family
by what the command does:

- Use `pack.local_read` for read/status/query/draft commands.
- Use `pack.local_write_approved` for deterministic writes that are scoped,
  safe, and approval-gated.
- Use `apprelay.reasoning` when the command needs ambiguity handling,
  summarization, or generation.
- Use `operatorkit.workflow` only for workflow coordination, staged automation,
  heartbeat, handoff, or accountability.

If a command uses `operatorkit.workflow` and OperatorKit is not configured,
CommandDeck blocks the command and should tell the user to clone and configure
OperatorKit from GitHub. If the command was mislabeled, change the route family
instead of installing OperatorKit.

The canonical blocked status for this case is
`blocked_missing_optional_dependency`. Treat it as either a setup task or a pack
authoring fix, not as permission to bypass the route.

The concrete V1 route for `pack.local_write_approved` is
`local.pack_write_approved`. It is contract-only for now. Approval may be
requested, but execution remains blocked until a future pack-write policy exists.

## Safety Rules

- Keep deterministic local reads read-only.
- Use approval-required for risky local control.
- Put safe phrase variants in `aliases`; do not rely on broad natural-language
  guessing.
- Do not include `script`, `scripts`, `shell`, `executable`, `handler`, `env`,
  or `secrets` in a command pack.
- Do not assume files in `scripts/` can run. Script execution requires a future
  explicit runner policy.
- Do not use raw spoken SQL or raw shell passthrough.

## Phrase Aliases

Custom packs may declare command-owned `aliases` for deterministic matching.
Aliases are additional ways to say the same command, not new behavior.

For example, a Sidekiq status command can declare:

```json
{
  "command_id": "pack.sidekiq_status",
  "example_utterances": ["Check Sidekiq status."],
  "aliases": ["Sidekiq status.", "Check worker.", "Is Sidekiq up?"]
}
```

Do not add broad aliases that could point to several commands. If a user says
`check server` and the pack has Puma, Sidekiq, and Redis, that should become a
concept-checking question, not a hidden default.

## If A Command Is Rejected

CommandDeck rejects unsafe custom-pack commands before execution. Rejection is
not a partial run and does not fall back to shell execution.

Common rejection cases:

- the manifest contains forbidden executable fields;
- a command references an unknown or pack-defined runner route;
- a command declares forbidden effects such as production writes or external
  provider calls;
- runtime behavior requests a stronger capability than the command declared.

A rejection should return:

- a short user-facing explanation;
- a developer diagnostic naming the pack, command, field, value, and rule;
- no execution;
- a `pack_command_rejected` audit event.

Fix the manifest or use an approved route. Do not work around rejection by
renaming the command or hiding behavior behind an alias.

To save a local diagnostic while opening a pack:

```sh
npm run command:local -- pack:open --command-pack path/to/custom.cdeck-pack.json --write-audit
```

Audit files are written under `.commanddeck/audit/pack-rejections/` by default.
They store sanitized validation errors, not script contents or secrets.

## Select The Pack

The SourceGrid Labs console should send a selection manifest with:

```json
{
  "pack_source_kind": "local-folder",
  "control_root_ref": "sourcegrid_labs_local",
  "pack_path": "command-packs/sourcegrid/sourcegrid.cdeck-pack.json"
}
```

The local CommandDeck runner then validates:

- the configured root is enabled;
- the root is `local_only: true` when absolute;
- `pack_path` stays inside the root;
- the selected file matches the standard layout;
- the manifest validates before becoming active.
