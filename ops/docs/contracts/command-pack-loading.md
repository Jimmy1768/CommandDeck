# Command-Pack Loading Contract

CommandDeck supports one selected JSON command pack per local command run. The
default pack is:

```text
contracts/commands/mvp-commands.json
```

Select a pack explicitly:

```sh
npm run command:local -- --command-pack contracts/commands/mvp-commands.json "What is my next SourceGrid task?"
```

## Validation Rules

- Pack paths must be repo-relative.
- Packs must include `schema_version: 0.1`.
- Commands must include all required command-pack fields.
- Routes must exist in `contracts/routes/route-contracts.json`.
- Contract-only packs must use routes with `real_integration: false`.
- Exact local preview packs may use `local.exact_read` with a built-in
  `runner_action`.
- Approval-gated local preview packs may use `local.exact_control` with a
  built-in `runner_action` plus `approval_prompt`.
- Permission levels must exclude `execute-now`.
- Approval-required commands must define `approval_prompt`.
- Fixture sources must stay under `evals/fixtures/`.
- Exact local runner sources must use `local://` descriptors.
- Executable fields are forbidden: `script`, `scripts`, `shell`,
  `executable`, `handler`, `env`, `secrets`.

Loading a command pack authorizes classification plus one of:

- fixture reads only; or
- built-in allowlisted local read-only runner actions.

It does not authorize arbitrary local script execution, external calls, file
mutation, OperatorKit dispatch, AppRelay calls, or ManyMind calls.

Generic example packs live under `evals/fixtures/command-packs/` so contract
tests can prove future owner packs have a stable shape. Real SourceGrid packs
belong in `sourcegrid-labs`, not in this repository.
