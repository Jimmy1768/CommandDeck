# Command-Pack Loading Contract

CommandKit Phase 1 supports one selected JSON command pack per local command
run. The default pack is:

```text
contracts/commands/mvp-commands.json
```

Select a pack explicitly:

```sh
npm run command:local -- --command-pack contracts/commands/mvp-commands.json "What is my next SourceGrid task?"
```

## Validation Rules

- Pack paths must be repo-relative.
- Commands must include all required command-pack fields.
- Routes must exist in `contracts/routes/route-contracts.json`.
- Routes must be contract-only with `real_integration: false`.
- Permission levels must exclude `execute-now`.
- Approval-required commands must define `approval_prompt`.
- Sources must stay under `evals/fixtures/` in Phase 1.
- Executable fields are forbidden: `script`, `scripts`, `shell`,
  `executable`, `handler`, `env`, `secrets`.

Loading a command pack authorizes classification and fixture reads only. It does
not authorize local script execution, external calls, file mutation, OperatorKit
dispatch, AppRelay calls, or ManyMind calls.
