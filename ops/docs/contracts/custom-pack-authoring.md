# Custom Pack Authoring Reference

This is the user-facing reference for creating CommandDeck custom packs.

## Source Of Truth

Core packs are owned by CommandDeck and live in the CommandDeck repo. Custom
packs are owned by the user, company, or partner and should live in that
owner's git repo or local control folder.

Do not copy company scripts, local env files, secrets, provider keys, or
credentials into CommandDeck core.

## Standard Layout

Use this standard layout:

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

## Release Fields

Custom packs must declare their own release identity. CommandDeck product
releases use `release-X.Y.Z`; pack releases use the same format; schema
versions stay separate and track manifest contract compatibility.

For a user-authored pack:

```json
{
  "schema_version": "0.1",
  "pack_id": "sourcecombatives.targets.v1",
  "pack_release": "release-0.1.0",
  "pack_scope": "user_custom",
  "commanddeck_release_compatibility": {
    "min": "release-0.1.0",
    "max_exclusive": "release-1.0.0"
  }
}
```

Use `sourcegrid_company` only for a SourceGrid Labs company-published pack.
Use `user_custom` for Jimmy/customer packs, even when they are stored inside
the `sourcegrid-labs` repo.

## What To Edit

For most voice shortcuts, start with `targets`, not scripts. Targets are named
objects that core actions can use as the command object slot.

Example target-only pack:

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

With that pack active, `computer open source combatives homepage activate`
resolves the target alias and asks for approval before opening the URL. The pack
does not need to define a command or script for that page.

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

Use pack-level `targets` for voice-friendly objects such as homepages,
dashboards, local app roots, repos, services, and working bookmarks. Do not
write one script per webpage.

Target declarations can be resolved by V1 runtime when a core target-aware
action, such as `open`, needs an object slot. They do not execute by themselves:
opening a URL target still routes through the core allowlisted runner and
requires approval.

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

## Target Aliases And Bookmarks

Voice should reduce friction. Users should not have to speak exact URLs such as
`https://example.com/admin/users?filter=active`, and pack authors should not
need to create a script for every page.

This is separate from command-owned phrase aliases. Command aliases choose a
declared command. Target aliases fill the object slot for that command.

Declare named targets instead:

```json
{
  "targets": [
    {
      "target_id": "sourcecombatives.homepage.prod",
      "kind": "url",
      "display_name": "Source Combatives homepage",
      "aliases": ["source combatives", "source combatives homepage"],
      "environment": "prod",
      "value": "https://sourcecombatives.com"
    }
  ]
}
```

Then the user can say:

```text
open source combatives homepage
```

The core `open` action handles the browser behavior. The custom pack only owns
the target name, environment, aliases, and URL.

For dev/prod pairs, declare both targets:

```json
{
  "target_id": "sourcecombatives.homepage.dev",
  "kind": "url",
  "display_name": "Source Combatives local homepage",
  "aliases": ["local source combatives", "source combatives dev"],
  "environment": "dev",
  "value": "http://localhost:3000"
}
```

If the pack declares a default environment, CommandDeck may use it only when the
route is safe. Otherwise it should ask a concept-checking question such as
`Open dev or production?`.

For short-term work, create bookmark targets:

```json
{
  "target_id": "sourcegrid.bookmark.webpage_1",
  "kind": "url",
  "display_name": "Webpage 1",
  "aliases": ["webpage one", "first page"],
  "bookmark": true,
  "value": "https://example.com/specific/page"
}
```

Codex can help copy exact URLs into the manifest or local target registry. The
important part is that CommandDeck receives structured target data, not raw
spoken URLs or arbitrary scripts.

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
