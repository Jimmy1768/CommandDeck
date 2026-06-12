# 0026: Custom Pack Capability Enforcement

Status: Accepted.

## Context

Custom packs are the extension point for owner-specific workspace routines.
Users can keep scripts in their own git repo or local control folder, but a
script existing beside a pack must not automatically make it executable through
CommandDeck.

CommandDeck must stay the command layer. OperatorKit is the action layer.
AppRelay may reason about ambiguity, but it must not bypass pack policy.

## Decision

Custom packs are deny-by-default. They may declare intents, targets, required
slots, approved routes, examples, sources, and risk metadata. They do not grant
execution authority by themselves.

CommandDeck enforces custom packs through this chain:

```text
schema -> capability registry -> risk policy -> approval check -> runner validation -> audit log
```

The enforcement behavior is:

- Bad pack shape rejects the pack load.
- Bad command declaration rejects command registration.
- Unsafe runtime request is blocked before side effects.
- Risky but allowed request requires explicit approval.
- Rejected commands do not fall back to arbitrary execution.
- AppRelay/capable-lane output must resolve back into the same structured
  command contract before anything can run.

Users may write any scripts they want in the owner repo. CommandDeck will only
route a command to a script-capable boundary when a future explicit runner
policy permits that route and the structured request passes validation.

## Required Rejection Output

When CommandDeck rejects a pack command, it should produce:

- a short user-facing message for the current surface;
- a developer diagnostic with pack, command, field, value, and violated rule;
- no execution;
- an audit event named `pack_command_rejected`.

Example diagnostic:

```text
pack: sourcegrid
command: sourcegrid.restart_everything
field: runner_route
value: shell.exec
rule: pack commands may only use approved runner routes
```

## Consequences

- Custom packs can be useful without becoming an arbitrary shell passthrough.
- Friendly aliases cannot hide unsafe behavior; declared route and risk remain
  authoritative.
- Learning memory may improve phrase matching, but it cannot create new
  execution capabilities.
- OperatorKit must re-check structured permissions at the runner boundary.

## Non-Goals

- No arbitrary shell execution in V1.
- No pack-defined runner routes in V1.
- No hidden script execution in V1.
- No production writes or destructive database actions through CommandDeck V1.
