# Learned Memory Item Contract

A learned memory item is a user-confirmed saved interpretation pattern.

The machine-readable contract lives at:

- `contracts/records/learned-memory-item.schema.json`

This contract is intentionally narrower than AppRelay's broader learning
pipeline. In CommandDeck V1, memory exists only after the user explicitly says
to save it.

## Required Fields

- `memory_id`
- `memory_kind`
- `status`
- `actor_ref`
- `scope`
- `match`
- `resolved_intent`
- `resolution_source`
- `confirmation_source`
- `saved_at`

Optional fields:

- `supersedes_memory_id`
- `notes`

## Core Rules

- memory is post-resolution writeback, not a live reasoning lane;
- runtime may read only `active` memory items;
- CommandDeck does not silently persist candidate memory;
- workspace scope lives in memory metadata, not inside `resolved_intent`.
- there may be at most one active memory for the same `scope + match`.

## V1 Memory Kind

- `resolved_interpretation`

That means the saved item is a mapping from a phrase pattern to a resolved
intent.

## Scope

V1 scope kinds:

- `workspace`
- `surface_workspace`

Examples:

- save for this workspace;
- save only for this watch in this workspace.

## Match Modes

V1 match kinds:

- `exact_phrase`
- `normalized_phrase`
- `alias`

This keeps the saved behavior narrow. CommandDeck learns stable interpretation
patterns, not broad permission bypasses or "do what I usually mean" behavior.

### Alias

An alias is a user-defined shorthand for a known target inside a scope.

Examples:

- `ops dashboard` means `pack.sourcegrid_ops_dashboard`
- `main app` means `pack.sourcegrid_main_repo`
- `worker` means `pack.sidekiq_service`
- `focus music` means `core.focus_playlist`

In V1, aliases resolve targets. They do not hide actions. The user still needs
to provide the action unless a separate command grammar explicitly supplies a
safe default.

Examples:

- `open ops dashboard` uses `open` as the action and `ops dashboard` as the
  target alias.
- `start worker` uses `start` as the action and `worker` as the target alias.

Full phrase shortcuts are not `alias` entries in V1 because they carry both
target and action.

## Lifecycle

V1 statuses:

- `active`
- `superseded`
- `forgotten`

`don't save` means no memory item is written. `replace existing` should create
the new item and point at the older item through `supersedes_memory_id`.

## Superseding

Superseding means a newer memory replaces an older memory for runtime use
without deleting history.

The required behavior is:

- the prior item changes from `active` to `superseded`;
- the replacement item becomes `active`;
- the replacement item stores `supersedes_memory_id` with the prior memory ID;
- runtime reads only the replacement item.

CommandDeck should not allow multiple active memory items with the same `scope`
and `match`. If a save would create that conflict and the user has not
explicitly chosen replacement, CommandDeck should ask a checking question
instead of keeping both active.
