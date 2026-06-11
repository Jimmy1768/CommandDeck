# CommandKit Product Boundary

CommandKit is the command shell that receives explicit user invocations,
normalizes the request, checks identity and permission, chooses a conservative
route, shapes the response, and records what happened.

It is intentionally separate from execution systems, model dispatch, and
decision-support workspaces.

## Owns

- Adapter intake contracts for Siri/Shortcuts and future thin surfaces.
- Command text normalization and command classification.
- Permission evaluation against explicit command-pack policy.
- Route selection between local deterministic answers, AppRelay, OperatorKit,
  and ManyMind.
- Approval-required prompt contracts.
- Action record schema and audit expectations.
- Fixture-based eval cases for recurring commands.

## Does Not Own

- Company-specific scripts or SourceGrid command packs.
- Partner command packs.
- Provider credential storage.
- AppRelay model/provider routing internals.
- OperatorKit workflow queues or execution records.
- ManyMind rooms, sleeves, source packets, or meeting state.
- Siri wake-word handling, speech-to-text, or device microphone permissions.
- Autonomous background actions.

## Slice 1 Boundary

This skeleton only defines contracts, docs, and fixtures. It must not perform
real state-changing work. Read-only and draft-only examples are represented as
fixtures, not integrations.
