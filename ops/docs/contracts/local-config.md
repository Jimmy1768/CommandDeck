# Local Config Contract

CommandKit may load a repo-relative JSON config file to choose local defaults.

Example:

```json
{
  "schema_version": "0.1",
  "default_command_pack": "contracts/commands/mvp-commands.json",
  "default_record_dir": "records/actions",
  "default_write_records": false
}
```

Run with an explicit config:

```sh
npm run command:local -- --config commandkit.config.example.json "What is my next SourceGrid task?"
```

## Rules

- Config path must be repo-relative.
- `default_command_pack` must be repo-relative.
- `default_record_dir` must stay inside the repo.
- `default_write_records` must be `false` in Phase 1.
- Config must not contain provider keys, secrets, env values, or execute-now
  switches.
- CLI flags may override command-pack and record-dir defaults for the current
  invocation only.
