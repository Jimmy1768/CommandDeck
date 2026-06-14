# 0039 CommandDeck Release And Pack Versioning

Status: Accepted.

## Context

CommandDeck is not a live-patched Rails app. It is a local command layer that
loads operational packs and may route voice-triggered work to local runners,
SourceGrid, AppRelay, and optional workflow systems.

Because packs define operational behavior, pack compatibility needs to be
explicit. A pack may be written by CommandDeck maintainers, SourceGrid Labs,
Jimmy, a customer, or a partner. Those packs can change independently from the
CommandDeck product release.

The word `sourcegrid` is overloaded unless scope is explicit:

- SourceGrid Labs can publish a company pack for the hosted tool.
- Jimmy can store a personal/custom pack inside the `sourcegrid-labs` repo.

Those are different ownership classes even when the files live in the same git
repository.

## Decision

CommandDeck product releases use DojoMate-style release names:

```text
release-X.Y.Z
```

The npm package version remains plain semver:

```text
X.Y.Z
```

Manifest `schema_version` remains a contract compatibility version. It is not
the product release and is not the pack behavior release.

Every command pack must declare:

- `pack_release`: independent pack behavior release in `release-X.Y.Z` format.
- `pack_scope`: ownership/scope class.
- `commanddeck_release_compatibility`: compatible CommandDeck product release
  range.

CommandDeck must enforce `commanddeck_release_compatibility` as:

```text
min <= current CommandDeck release < max_exclusive
```

If the current CommandDeck release is outside that range, pack loading fails
closed. CommandDeck must not auto-migrate, guess compatibility, or run the pack
partially.

Allowed pack scopes:

- `commanddeck_core`: built-in CommandDeck core pack maintained in this repo.
- `sourcegrid_company`: SourceGrid Labs company-published pack.
- `user_custom`: user/customer/Jimmy-authored workspace pack.
- `partner_custom`: partner-authored pack.
- `fixture_legacy`: repo fixtures and historical eval packs only.

If a Jimmy-authored custom pack lives inside `sourcegrid-labs`, its
`pack_scope` is still `user_custom`, not `sourcegrid_company`.

The CommandDeck core pack is a versioned behavior API. Custom packs may depend
on core actions, target alias resolution, approval semantics, route-family
behavior, and concept-checking question behavior. Therefore core behavior must
not be silently removed or redefined inside a compatible release range.

Compatibility rules:

- additive core actions are allowed when they do not change existing behavior;
- incompatible core behavior changes require a new product release boundary;
- legacy core behavior should be preserved for compatible packs when practical;
- if legacy behavior cannot be preserved, CommandDeck must reject the
  incompatible pack explicitly instead of guessing or silently migrating;
- deprecation is allowed only with a documented migration path and compatibility
  cutoff.

## Consequences

Pack validation can reject manifests that omit release compatibility.

Pack authors can version operational behavior independently from CommandDeck
core.

SourceGrid selectors and CommandDeck logs can distinguish company-published
packs from user-authored packs without relying on repo path guesses.

Existing historical/eval packs are marked `fixture_legacy` so they do not look
like production pack templates.

The release contract makes core behavior drift visible. A spoken command should
not start doing a different operational action only because CommandDeck or a
pack changed underneath the user.

Incompatible packs should produce a setup/compatibility response that includes:

- current CommandDeck release;
- pack compatibility range;
- pack id and pack release when available;
- the corrective path: update CommandDeck, update the pack, or select another
  compatible pack.
