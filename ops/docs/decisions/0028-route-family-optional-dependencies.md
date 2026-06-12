# 0028: Route Families And Optional Dependencies

Status: Accepted.

## Context

CommandDeck can route both core commands and custom-pack commands. Some routes
need neighboring systems, but the existence of a custom pack must not imply a
hard dependency on OperatorKit.

OperatorKit is needed only for OperatorKit-owned workflow coordination, staged
automation, heartbeat, and accountability routes. Other custom-pack commands
may be local reads, scoped local writes, or AppRelay-mediated reasoning.

## Decision

CommandDeck routes by capability, not by product dependency.

The V1 route families are:

- `core.local`: built-in computer/platform actions such as opening apps, URLs,
  dashboards, media control, and exact local status.
- `pack.local_read`: custom-pack read/status/query/draft commands that do not
  mutate external state.
- `pack.local_write_approved`: deterministic custom-pack writes that require
  explicit approval and scoped safe environments.
- `apprelay.reasoning`: ambiguity resolution, summarization, generation, or
  other LLM-mediated work.
- `operatorkit.workflow`: OperatorKit-owned workflow coordination, staged
  automation, heartbeat, handoff, and accountability.

OperatorKit is an optional route dependency only. If a selected command requires
`operatorkit.workflow` and OperatorKit is not configured, CommandDeck must
return a blocked setup response. It must not fall back to local shell execution
or silently substitute another route.

Custom packs do not automatically require OperatorKit. Risk and route decide the
execution policy.

## User-Facing Setup Rule

When an OperatorKit route is blocked because the dependency is missing,
CommandDeck should tell the user:

```text
This command requires OperatorKit workflow support, but OperatorKit is not
configured. Clone OperatorKit from GitHub, configure it locally, add its local
path or endpoint to CommandDeck config, then retry.
```

If the command was mislabeled as an OperatorKit workflow, the fix is to change
the route family, not install OperatorKit.

## Consequences

- CommandDeck remains useful without OperatorKit.
- Custom packs can support local reads and approved local writes without
  OperatorKit.
- OperatorKit remains the route for workflow coordination and heartbeat.
- Missing optional dependencies fail closed with setup guidance.

## Non-Goals

- No hard OperatorKit install requirement.
- No fallback shell execution when OperatorKit is missing.
- No automatic route substitution.
