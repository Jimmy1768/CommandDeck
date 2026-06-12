# Adding Command Packs

CommandDeck can load and validate command-pack JSON files. The default MVP path
is fixture-only. A separate built-in preview pack can execute allowlisted local
read-only runner actions.

Use this split when deciding where a new capability belongs:

- put it in core if it is a generic reusable computer-control primitive for the
  active platform target;
- put it in a pack if it is a workspace-specific routine for SourceGrid or a
  particular user.

## Where Packs Live

- SourceGrid company packs and scripts live in `sourcegrid-labs`.
- Personal assistant packs and scripts live in the user's assistant repo, for
  example `jimmys-assistant`.
- Partner packs live in partner repos or configured local command folders.
- This repo may contain only generic examples, tests, and contract fixtures.

CommandDeck attaches to SourceGrid first for identity, entitlement, and AppRelay
billing readiness. Owner repos are command-pack sources only; they are not the
payment or entitlement authority.

Do not copy SourceGrid company scripts, personal assistant scripts, partner
scripts, secrets, local env values, provider keys, or workflow credentials into
this repo.

## Standard Custom Pack Layout

Custom pack repos and local control folders should use this V1 layout:

```text
<owner-control-repo>/
  command-packs/
    <pack_slug>/
      <pack_slug>.cdeck-pack.json
      README.md
      fixtures/
      scripts/
```

Create it with:

```sh
npm run command:local -- pack:init --control-root /path/to/owner-repo --pack-slug sourcegrid --owner sourcegrid
```

Rules:

- `pack_slug` uses lowercase kebab-case, for example `sourcegrid` or
  `jimmy-local`.
- The selected manifest path is
  `command-packs/<pack_slug>/<pack_slug>.cdeck-pack.json`.
- `README.md` explains what the pack is for and who owns it.
- `fixtures/` may hold pack-owned test or example data.
- `scripts/` may hold owner-repo scripts, but selecting a pack does not grant
  script execution by itself.

Example:

```text
sourcegrid-labs/
  command-packs/
    sourcegrid/
      sourcegrid.cdeck-pack.json
      README.md
      fixtures/
      scripts/
```

## Pack Readiness Checklist

- Include `schema_version`, `pack_id`, `owner`, `permissions`,
  `record_policy`, and `commands`.
- Keep command sources under `evals/fixtures/` for fixture-backed examples.
- Use `local://` sources only when the command uses a built-in `runner_action`.
- Use only `read-only`, `draft-only`, or `approval-required` permission levels.
- Keep `execute-now` disabled.
- Use routes from `contracts/routes/route-contracts.json`.
- Pick the route family by capability. Custom packs do not automatically require
  OperatorKit.
- Keep owner-pack routes contract-only with `real_integration: false`.
- Use `local.exact_read` only for CommandDeck-owned built-in preview commands.
- Add `approval_prompt` for every `approval-required` command.
- Add pack-level `action_requirements` for pack-specific actions whose required
  slots are not covered by the core action requirements contract.
- Treat `action_requirements` as clarification metadata only; resumed commands
  must still resolve through the active pack's commands, routes, permissions,
  effects, and runner allowlists.
- Do not include executable fields such as `script`, `shell`, `handler`, `env`,
  or `secrets`.

Route-family guidance:

- `pack.local_read`: read/status/query/draft commands.
- `pack.local_write_approved`: deterministic scoped writes with explicit
  approval. Use concrete route `local.pack_write_approved`; it is contract-only
  until a future write policy exists.
- `apprelay.reasoning`: ambiguity handling, summarization, or generation.
- `operatorkit.workflow`: workflow coordination, staged automation, heartbeat,
  handoff, and accountability.

## Validation

Run:

```sh
npm run verify
```

The verification gate checks the built-in MVP pack, the built-in exact local
preview pack, generic fixture packs, route contracts, permission levels, source
paths, and safety evals. Passing validation means the pack is ready for
classification and, when applicable, built-in allowlisted local read-only
actions only.

## Future Integration

Future command-pack discovery can point CommandDeck at configured local folders
or owner repos such as `sourcegrid-labs` or a user's personal assistant repo
after SourceGrid attachment is established. The pack contract should remain
stable: CommandDeck classifies, checks permission, records action intent, and
routes through declared boundaries. AppRelay, OperatorKit, and ManyMind
integrations remain external contracts until a later phase explicitly implements
them.
