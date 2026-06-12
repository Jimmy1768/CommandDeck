# 0030: Missing Optional Dependency Response

Status: Accepted.

## Context

Decision 0028 makes OperatorKit and AppRelay optional route dependencies rather
than global CommandDeck dependencies. When a selected route needs an optional
dependency that is not configured, CommandDeck needs a precise blocked response.

The response must help the user distinguish two cases:

- the route is correct and the dependency needs setup;
- the pack route is mislabeled and should be changed.

## Decision

Use `blocked_missing_optional_dependency` as the canonical action-record result
status.

The result must include:

- `route_family`;
- `missing_dependency`;
- `setup_required`;
- `can_retry_after_setup`;
- `setup_hint`;
- `authoring_fix_hint`.

Example:

```json
{
  "status": "blocked_missing_optional_dependency",
  "summary": "This command requires OperatorKit workflow support, but OperatorKit is not configured.",
  "route_family": "operatorkit.workflow",
  "missing_dependency": "operator-kit",
  "setup_required": true,
  "can_retry_after_setup": true,
  "setup_hint": "Clone and configure OperatorKit from GitHub, then add its local path or endpoint to CommandDeck config.",
  "authoring_fix_hint": "If this command is not workflow coordination, change the command route family in the pack."
}
```

CommandDeck must not fall back to shell execution or silently substitute another
route.

## Consequences

- Users get setup guidance when a real dependency is missing.
- Pack authors get a clear hint when they selected the wrong route family.
- Optional dependencies remain optional globally.

## Non-Goals

- No automatic dependency installation.
- No GitHub clone operation from CommandDeck.
- No route fallback.
