# CommandKit Product Boundary

CommandKit is the command shell that receives explicit user invocations,
normalizes the request, checks identity and permission, chooses a conservative
route, shapes the response, and records what happened.

Its primary product role is hands-off local workspace control using the PC as
the command runner. Voice adapters and shortcuts let the user command the
workspace while away from the keyboard: open apps, switch devices, inspect
service state, start approved local routines, and prepare draft artifacts.

It is intentionally separate from Codex, execution systems, model dispatch, and
decision-support workspaces.

## Owns

- Adapter intake contracts for Siri/Shortcuts and future thin surfaces.
- Command text normalization and command classification.
- Permission evaluation against explicit command-pack policy.
- Route selection between local deterministic answers, AppRelay, OperatorKit,
  and ManyMind.
- Workspace command-flow contracts for PC-command automation.
- Approval-required prompt contracts.
- Action record schema and audit expectations.
- Fixture-based eval cases for recurring commands.

## Does Not Own

- Code editing as a voice workflow.
- Codex repo reasoning, patch generation, or code review.
- Company-specific scripts or SourceGrid command packs.
- Partner command packs.
- Provider credential storage.
- AppRelay model/provider routing internals.
- OperatorKit workflow queues or execution records.
- ManyMind rooms, sleeves, source packets, or meeting state.
- Siri wake-word handling, speech-to-text, or device microphone permissions.
- Autonomous background actions.

## Code Editing Boundary

If editing code, the user works from the PC in Codex or the normal local
development toolchain. CommandKit may help prepare the workspace, summarize
state, start local services, or open tools, but it does not replace Codex as the
coding interface.

This is especially important for SourceGrid and similar repos where local
services such as Puma, Sidekiq, databases, simulators, browser sessions, and
local credentials live on the PC runner.

## Slice 1 Boundary

This skeleton only defines contracts, docs, and fixtures. It must not perform
real state-changing work. Read-only and draft-only examples are represented as
fixtures, not integrations.
