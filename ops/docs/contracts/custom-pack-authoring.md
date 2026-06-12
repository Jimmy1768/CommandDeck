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

## Safety Rules

- Keep deterministic local reads read-only.
- Use approval-required for risky local control.
- Do not include `script`, `scripts`, `shell`, `executable`, `handler`, `env`,
  or `secrets` in a command pack.
- Do not assume files in `scripts/` can run. Script execution requires a future
  explicit runner policy.
- Do not use CommandDeck to replace Codex for code implementation prompts.

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
