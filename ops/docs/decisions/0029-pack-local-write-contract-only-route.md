# 0029: Pack Local Write Contract-Only Route

Status: Accepted.

## Context

Decision 0028 names the `pack.local_write_approved` route family, but the route
contract did not define a concrete route for custom-pack writes.

The product needs an honest route for future commands such as creating a dummy
dev record or running a named non-production mutation, while avoiding write
execution before the write policy is designed.

## Decision

Add `local.pack_write_approved` as a contract-only route.

Route properties:

- route family: `pack.local_write_approved`;
- permission level: `approval-required`;
- credit policy: no SourceGrid credits required;
- execution status: `real_integration: false`;
- behavior: `blocked_contract_only_pending_pack_write_policy`.

Future allowed effects may include scoped dev/test writes, dummy record
creation, and named non-production mutations.

Forbidden effects include raw SQL passthrough, production writes, customer data
mutation, secret writes, and external provider mutation.

## Consequences

- Pack authors can target a real route id without inventing routes.
- CommandDeck remains non-executing for custom-pack writes.
- Approval is necessary but not sufficient; execution still requires a future
  pack-write policy.

## Non-Goals

- No DB writes in V1.
- No raw spoken SQL.
- No production mutation.
- No custom script execution.
