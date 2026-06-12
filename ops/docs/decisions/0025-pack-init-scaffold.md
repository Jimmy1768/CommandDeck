# 0025: Pack Init Scaffold

Status: Accepted for V1.

## Context

Custom packs need a predictable layout and safe starter manifest. Users can
create folders manually, but manual setup increases drift in filenames, folder
shape, and safety defaults.

## Decision

Add `pack:init` as a conservative scaffold command:

```sh
npm run command:local -- pack:init --control-root /path/to/owner-repo --pack-slug sourcegrid --owner sourcegrid
```

It creates:

```text
command-packs/
  <pack_slug>/
    <pack_slug>.cdeck-pack.json
    README.md
    fixtures/
    scripts/
```

The generated manifest is read-only and contains no executable fields, secrets,
env values, provider keys, or execute-now authority.

## Guardrails

- `pack_slug` must be lowercase kebab-case.
- `owner` must be a stable lowercase identifier.
- Existing manifest or README files are not overwritten.
- The command is a file/template generator only.
- `scripts/` is created for owner repo organization, not execution authority.

## Non-Goals

- No `--force` in V1.
- No script execution.
- No owner repo crawling.
- No automatic pack activation.
