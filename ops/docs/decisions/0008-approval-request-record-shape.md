# 0008: Approval Request Record Shape

Status: Accepted for Phase 1 prototype.

## Context

Approval-required commands must explain what would need human approval without
executing the action. The existing command-pack contract already requires an
approval prompt, but action records did not expose the prompt fields directly.

## Decision

Add `approval_request` to action records.

For approval-required commands, `approval_request` includes:

- `target`;
- `action`;
- `risk`;
- `expected_record`.

For read-only, draft-only, and failed-closed records, `approval_request` is
`null`.

## Consequences

- Approval-required command records are self-contained.
- Voice invocation remains separate from approval.
- Slice 1 still blocks execution and does not request approval interactively.
