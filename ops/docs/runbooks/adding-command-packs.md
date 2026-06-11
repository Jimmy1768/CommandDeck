# Adding Command Packs

CommandKit Phase 1 can load and validate command-pack JSON files. It cannot
execute real workflows.

## Where Packs Live

- SourceGrid company packs and scripts live in `sourcegrid-labs`.
- Personal assistant packs and scripts live in the user's assistant repo, for
  example `jimmys-assistant`.
- Partner packs live in partner repos or configured local command folders.
- This repo may contain only generic examples, tests, and contract fixtures.

Do not copy SourceGrid company scripts, personal assistant scripts, partner
scripts, secrets, local env values, provider keys, or workflow credentials into
this repo.

## Pack Readiness Checklist

- Include `schema_version`, `pack_id`, `owner`, `permissions`,
  `record_policy`, and `commands`.
- Keep command sources under `evals/fixtures/` for Phase 1 examples.
- Use only `read-only`, `draft-only`, or `approval-required` permission levels.
- Keep `execute-now` disabled.
- Use routes from `contracts/routes/route-contracts.json`.
- Keep routes contract-only with `real_integration: false`.
- Add `approval_prompt` for every `approval-required` command.
- Do not include executable fields such as `script`, `shell`, `handler`, `env`,
  or `secrets`.

## Validation

Run:

```sh
npm run verify
```

The verification gate checks the built-in MVP pack, generic fixture packs, route
contracts, permission levels, source paths, and safety evals. Passing validation
means the pack is ready for classification and fixture reads only.

## Future Integration

Future command-pack discovery can point CommandKit at configured local folders
or owner repos such as `sourcegrid-labs` or a user's personal assistant repo.
The pack contract should remain stable: CommandKit classifies, checks
permission, records action intent, and routes through declared boundaries.
AppRelay, OperatorKit, and ManyMind integrations remain external contracts
until a later phase explicitly implements them.
