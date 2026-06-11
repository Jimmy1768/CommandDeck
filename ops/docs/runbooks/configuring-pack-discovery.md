# Configuring Pack Discovery

Use pack discovery declarations to describe where CommandKit may find command
packs later. Do not use them to run scripts.

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

SourceGrid command packs belong in `sourcegrid-labs`. CommandKit may later be
configured to read pack metadata from that repo, but this repository must not
copy SourceGrid-specific scripts, credentials, or command packs into core.

Partner packs follow the same rule: keep pack ownership in the partner repo or
a configured local folder.

## Validation

Run:

```sh
npm run verify
```

Validation rejects executable fields, provider secrets, non-metadata discovery
modes, unsafe absolute paths, and repo-fixture roots outside
`evals/fixtures/command-packs`.
