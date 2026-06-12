# 0022. Minimal Local CCQ Resume Implementation

Date: 2026-06-12

## Status

Accepted.

## Context

CommandDeck now has contracts for concept-checking questions, resume token
binding, one-use consumption, action-record-backed state, and audit cleanup.
Leaving CCQ contract-only would slow validation of Siri-style clarification
loops.

## Decision

Implement a minimal local CCQ/resume path for deterministic core/local commands.

The implementation may:

- return `needs_clarification` when a core action is present but the required
  object slot is missing;
- write the CCQ action record only when normal record persistence is explicitly
  requested;
- resume with `ccq:resume --record-file ... --resume-token ...`;
- fill missing slots only;
- revalidate the merged command against the active command pack;
- route through existing local exact/approval-gated boundaries.

The implementation must not:

- call AppRelay for deterministic local CCQ handling;
- execute pack scripts;
- semantically rewrite the user's answer;
- bypass approval;
- perform automatic cleanup.

## Consequences

- Siri/Shortcuts-style clarification loops can be tested locally.
- CCQ state remains explicit and auditable through action records.
- The implementation is intentionally narrow and should be expanded only after
  more command-pack and adapter behavior is proven.
