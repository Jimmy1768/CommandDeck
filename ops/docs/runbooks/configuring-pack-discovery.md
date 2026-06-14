# Configuring Pack Discovery

Use pack discovery declarations to describe where CommandDeck may find command
packs later. Do not use them to run scripts.

Only one command pack is active for a command invocation. The active pack is
selected by `default_command_pack` or an explicit command-pack override.
`command_pack_roots` only declare places packs may be selected from later.

Use `pack:open` and `pack:recent` as the local pack selection surface:

```sh
npm run command:local -- pack:open --command-pack contracts/commands/core-commands.cdeck-pack.json
npm run command:local -- pack:open --command-pack contracts/commands/core-commands.cdeck-pack.json --write-state
npm run command:local -- pack:recent
```

`pack:open` validates one selected pack. `pack:recent` lists recently opened
packs from local CommandDeck UI state. The built-in core pack is the normal
default; local-exact/local-approved packs are legacy compatibility fixtures.

User-facing pack selection should target the pack manifest file, not a folder.
The manifest filename convention is `*.cdeck-pack.json`, where `cdeck` means
CommandDeck. Selector UIs should filter to that extension.

## Safe Phase 1 Example

```json
{
  "command_pack_roots": [
    {
      "id": "fixture_command_packs",
      "kind": "repo-fixture",
      "path": "evals/fixtures/command-packs",
      "enabled": true,
      "discovery_mode": "metadata_only"
    },
    {
      "id": "sourcegrid_labs_future",
      "kind": "owner-repo",
      "repo_slug": "sourcegrid-labs",
      "enabled": false,
      "discovery_mode": "metadata_only"
    }
  ]
}
```

## Owner Repo Boundary

SourceGrid command packs belong in `sourcegrid-labs`. CommandDeck may later be
configured to read pack metadata from that repo, but this repository must not
copy SourceGrid-specific scripts, credentials, or command packs into core.

SourceGrid attachment is separate from pack discovery. CommandDeck attaches to a
SourceGrid workspace for identity, entitlement, and billing readiness; owner
repos are then declared as command-pack sources.

Partner packs follow the same rule: keep pack ownership in the partner repo or
a configured local folder.

## External Local Control Folders

Custom packs should be version controlled in the user's or company's own git
repo. Configure the local clone or control folder as a `local-folder` root:

```json
{
  "id": "sourcegrid_labs_local",
  "kind": "local-folder",
  "path": "/Users/jimmy1768/Projects/sourcegrid-labs",
  "local_only": true,
  "enabled": true,
  "discovery_mode": "metadata_only"
}
```

Selections from that root still use a relative `pack_path`, for example
`command-packs/sourcegrid/sourcegrid.cdeck-pack.json`. CommandDeck validates
that the resolved file stays inside the configured root before loading it.

The standard custom pack layout is:

```text
<owner-control-repo>/
  command-packs/
    <pack_slug>/
      <pack_slug>.cdeck-pack.json
      README.md
      fixtures/
      scripts/
```

External local-folder selections must use
`command-packs/<pack_slug>/<pack_slug>.cdeck-pack.json`.

The selected manifest must include release metadata:

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

Use `sourcegrid_company` only for SourceGrid Labs company-published packs. Use
`user_custom` for user/Jimmy/customer-authored packs, even when the control
folder is `sourcegrid-labs`.

Use `pack:init` to create this layout safely:

```sh
npm run command:local -- pack:init --control-root /Users/jimmy1768/Projects/sourcegrid-labs --pack-slug sourcegrid --owner sourcegrid
```

## Validation

Run:

```sh
npm run verify
```

Validation rejects executable fields, provider secrets, non-metadata discovery
modes, unsafe absolute paths without `local_only: true`, and repo-fixture roots
outside `evals/fixtures/command-packs`.

Validation does not activate multiple roots. If a user needs to switch from a
SourceGrid pack to a personal pack, they should switch the active pack, not run
both at once.
