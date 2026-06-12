# Action Requirements Contract

Action requirements define which spoken command slots are required for a given
action.

The machine-readable contracts live at:

- `contracts/commands/action-requirements.schema.json`
- `contracts/commands/core-action-requirements.json`

## Ownership

CommandDeck core owns the schema and the generic core actions.

Command packs may declare requirements for pack-specific actions, but
CommandDeck validates them against the shared schema. Packs do not get to invent
hidden grammar semantics or bypass concept-checking questions.

## Runtime Source

For deterministic core CCQs, the runtime source is
`contracts/commands/core-action-requirements.json`. CommandDeck loads and
validates that file before deciding whether a core spoken action is missing a
required object.

The runtime must not keep a separate hardcoded core action map. If a core action
or its missing-slot question changes, update the contract file first.

## Required Action Fields

Each action requirement must declare:

- `action`
- `capability_source`
- `required_slots`
- `optional_slots`
- `allowed_target_kinds`
- `defaulting_rules`
- `risk_tier`
- `approval_may_be_required`
- `missing_required_slot_ccq`

Actions may also declare `conditionally_required_slots`.

## Slot Rules

V1 slots:

- `device_code`
- `action`
- `object`
- `context`
- `end_code`

Missing required slots force a concept-checking question.

Conditionally required slots also force a concept-checking question when the
condition cannot be safely defaulted.

Defaults are allowed only when there is exactly one safe active-context
candidate for that action and risk tier.

## Core V1 Actions

The first core action requirements cover:

- `open`
- `close`
- `find`
- `start`
- `stop`
- `play`
- `pause`

These are starting conventions, not a universal action ontology. Pack authors
can add workspace-specific actions later using the same schema.

## Pack Runtime Boundary

Pack action requirements are loaded only from the active command pack. They are
used to ask concept-checking questions for missing required slots, not to route
or execute commands by themselves.

After a pack CCQ resume, the merged command must resolve through the same active
pack command, route, permission, effect, and runner allowlist checks as any
other command. If the resumed command is not classifiable, CommandDeck fails
closed or asks a fresh CCQ.
