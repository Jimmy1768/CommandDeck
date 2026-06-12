# Command-Pack Loading Contract

CommandDeck supports one selected JSON command pack per local command run. The
default pack is:

```text
contracts/commands/mvp-commands.cdeck-pack.json
```

Pack manifests use the `.cdeck-pack.json` extension, where `cdeck` means
CommandDeck. Pack selection UIs should filter for `*.cdeck-pack.json` and
select the manifest file, not an arbitrary folder.

Select a pack explicitly:

```sh
npm run command:local -- --command-pack contracts/commands/mvp-commands.cdeck-pack.json "What is my next SourceGrid task?"
```

Open and recent pack surfaces:

```sh
npm run command:local -- pack:open --command-pack contracts/commands/local-exact-commands.cdeck-pack.json
npm run command:local -- pack:open --command-pack contracts/commands/local-exact-commands.cdeck-pack.json --write-state
npm run command:local -- pack:recent
```

`pack:open` validates exactly one pack. It does not execute commands and does
not combine packs. `pack:recent` reads local recent-pack UI state.

## Validation Rules

- Direct CLI pack paths must be repo-relative.
- Pack paths must end with `.cdeck-pack.json`.
- External custom packs may be loaded only after a SourceGrid/local selection
  maps them through a configured `local-folder` root with `local_only: true`.
- Packs must include `schema_version: 0.1`.
- Commands must include all required command-pack fields.
- Routes must exist in `contracts/routes/route-contracts.json`.
- Route family decides optional dependencies. Custom packs do not automatically
  require OperatorKit.
- Contract-only packs must use routes with `real_integration: false`.
- Exact local preview packs may use `local.exact_read` with a built-in
  `runner_action`.
- Approval-gated local preview packs may use `local.exact_control` with a
  built-in `runner_action` plus `approval_prompt`.
- Custom packs may declare `local.pack_write_approved` for future
  approval-gated writes, but the route is contract-only and cannot execute yet.
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
`local.pack_write_approved` is a declared future route, not write authority.

If a selected route requires an optional dependency such as OperatorKit or
AppRelay and that dependency is not configured, CommandDeck must fail closed
with setup guidance. It must not fall back to shell execution or another route.

Persisting recent-pack UI state requires `--write-state`. By default,
`pack:open` is read-only and reports `recent_write.status: not_written`.

Generic example packs live under `evals/fixtures/command-packs/` so contract
tests can prove future owner packs have a stable shape. Real SourceGrid packs
belong in `sourcegrid-labs`, not in this repository.

Core packs are CommandDeck-owned. Custom packs should be version controlled in
the user's or company's own git repo or local control folder, then selected by
manifest path through local validation.
