# Resolved Intent Contract

`resolved_intent` is the small routing-oriented meaning shape that CommandDeck
stores after a command has been safely understood.

The machine-readable contract lives at:

- `contracts/records/resolved-intent.schema.json`

## Required Fields

- `action`
- `target_kind`
- `target_ref`
- `capability_source`
- `route`
- `risk_tier`
- `approval_required`

Optional fields:

- `surface_ref`
- `context_bindings`

## Design Rules

- `resolved_intent` is for routing, not for storing the whole conversation.
- `target_kind` stays a small stable enum.
- `target_ref` stays dynamic and namespaced.
- workspace scoping belongs on the memory item metadata by default, not inside
  the resolved intent.
- a resolved intent never bypasses approval or route selection.

## V1 Target Kinds

- `app`
- `url`
- `dashboard`
- `repo`
- `service`
- `media`
- `device`
- `workflow`
- `data_view`
- `runtime`
- `delegate`

## `target_ref`

`target_ref` must be a namespaced identifier with one of these prefixes:

- `core.`
- `pack.`
- `delegate.`

Examples:

- `core.current_repo`
- `core.music_app`
- `pack.sourcegrid_ops_dashboard`
- `pack.main_web_service`
- `delegate.apprelay`

## Why `action` Is Still A String

V1 keeps `action` as a stable string instead of a giant global enum. The target
space is already split into a small `target_kind` plus a dynamic `target_ref`.
Keeping `action` flexible lets CommandDeck support both core routines and pack
commands without pretending all future workflows can be fully enumerated now.
