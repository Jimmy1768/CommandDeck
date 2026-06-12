# 0024: Custom Pack Repo Layout

Status: Accepted for V1.

## Context

Custom packs belong to the user, company, or partner that owns the workspace
automation. CommandDeck needs a predictable selector target without copying
custom pack content into CommandDeck core.

## Decision

Custom pack repos and local control folders use this layout:

```text
<owner-control-repo>/
  command-packs/
    <pack_slug>/
      <pack_slug>.cdeck-pack.json
      README.md
      fixtures/
      scripts/
```

Rules:

- `pack_slug` is lowercase kebab-case.
- The selected manifest path is
  `command-packs/<pack_slug>/<pack_slug>.cdeck-pack.json`.
- SourceGrid Labs and local selectors should filter for `*.cdeck-pack.json`.
- `README.md`, `fixtures/`, and `scripts/` are pack-owned repo content.
- Selecting a pack validates the manifest only; it does not grant script
  execution authority.

## Consequences

- SourceGrid Labs can present a predictable pack picker.
- Users have a clear starter layout for custom packs.
- CommandDeck can keep direct core pack paths separate from external custom
  pack paths.

## Non-Goals

- No arbitrary folder execution.
- No automatic crawling of owner repos.
- No script execution from `scripts/` without a future explicit runner policy.
