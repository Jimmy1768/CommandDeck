# Local Config Contract

CommandDeck may load a repo-relative JSON config file to choose local defaults.

Example:

```json
{
  "schema_version": "0.1",
  "default_command_pack": "contracts/commands/core-commands.cdeck-pack.json",
  "default_record_dir": "records/actions",
  "default_write_records": false,
  "sourcegrid_attachment": {
    "schema_version": "0.1",
    "status": "contract_only",
    "sourcegrid_workspace_ref": "workspace_sourcegrid_fixture",
    "sourcegrid_account_ref": "account_sourcegrid_fixture",
    "billing_owner": "sourcegrid_workspace",
    "payment_method_state": "missing",
    "payment_method_label": null,
    "apprelay_spend_policy": "disabled_until_payment_verified",
    "command_pack_owner_repos": ["sourcegrid-labs"]
  },
  "command_pack_roots": [
    {
      "id": "fixture_command_packs",
      "kind": "repo-fixture",
      "path": "evals/fixtures/command-packs",
      "enabled": true,
      "discovery_mode": "metadata_only"
    }
  ]
}
```

Run with an explicit config:

```sh
npm run command:local -- --config commanddeck.config.example.json "What is my next SourceGrid task?"
```

## Rules

- Config path must be repo-relative.
- `default_command_pack` must be repo-relative.
- `default_command_pack` is the single active command pack for an invocation.
- `default_record_dir` must stay inside the repo.
- `default_write_records` must be `false` in Phase 1.
- Config must not contain provider keys, secrets, env values, or execute-now
  switches.
- Config must not contain raw payment method details, card data, payment
  tokens, or provider billing credentials.
- `sourcegrid_attachment`, when present, is non-sensitive attachment and
  payment-readiness metadata only.
- `command_pack_roots`, when present, must be metadata-only declarations.
- `command_pack_roots` are available pack locations only; they are not active
  routing profiles and CommandDeck must not combine multiple packs for one
  command.
- Pack selection uses `open` and `recent` surfaces over configured control repos
  or local control folders.
- Pack discovery roots cannot contain executable fields or secrets.
- Repo fixture roots must stay under `evals/fixtures/command-packs`.
- Absolute local-folder discovery paths require `local_only: true` and are used
  only after local pack-selection validation.
- CLI flags may override command-pack and record-dir defaults for the current
  invocation only.

Check local SourceGrid attachment status:

```sh
npm run command:local -- sourcegrid:status --config commanddeck.config.example.json
```
