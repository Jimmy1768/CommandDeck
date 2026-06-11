# 0009: Approval Decision Contract

Status: Accepted for Phase 1 prototype.

## Context

CommandKit now records approval requests for approval-required commands. It also
needs a deterministic way to model future human decisions without dispatching
OperatorKit, AppRelay, ManyMind, or any external system.

## Decision

Add an approval decision contract and fixtures. Approval decisions are separate
from adapter requests and action records.

An approval decision includes:

- `decision_id`;
- `record_id`;
- `actor_ref`;
- `decision`;
- `decided_at`;
- `reason`;
- `scope`;
- `expires_at`.

In Phase 1:

- a denied decision produces `denied_no_execution`;
- an approved decision produces `approved_execution_disabled`;
- an expired decision produces `rejected_expired`;
- no decision can execute an action.

## Consequences

- Approval modeling is testable before execution exists.
- Human approval remains separate from voice invocation.
- Future execution still requires a separate decision and execution gate.
