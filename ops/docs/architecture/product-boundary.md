# CommandDeck Product Boundary

CommandDeck is the command shell that receives explicit user invocations,
normalizes the request, checks identity and permission, chooses a conservative
route, shapes the response, and records what happened.

Its primary product role is hands-off local workspace control using the PC as
the command runner. Voice adapters and shortcuts let the user command the
workspace while away from the keyboard: open apps, switch devices, inspect
service state, start approved local routines, and prepare draft artifacts.
It is a productivity multiplier for operating the workspace, not the coding
interface itself.

It is intentionally separate from Codex, execution systems, model dispatch, and
decision-support workspaces.

## Two Axes

CommandDeck is easiest to reason about as two separate axes:

- capability source:
  - `core`: generic built-in actions and engine behavior owned by CommandDeck;
  - `pack`: workspace-specific routines owned by a company, partner, or user.
- execution mode:
  - exact/local/deterministic;
  - capable/AppRelay-mediated.

Those axes are orthogonal. A routine may come from core or from a pack, and it
may be exact/local or AppRelay-mediated depending on what the command needs.

For the first platform target, core is Apple-first. Siri and Shortcuts reduce
the amount of new infrastructure CommandDeck must build, so a default Apple-PC
action set is a valid product choice rather than an architectural violation.

## Owns

- Adapter intake contracts for Siri/Shortcuts and future thin surfaces.
- Generic built-in actions that are reusable across users on the active
  platform target.
- SourceGrid attachment status for identity, entitlement, and AppRelay billing
  readiness.
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
- Payment method storage or raw billing credentials.
- Provider credential storage.
- AppRelay model/provider routing internals.
- OperatorKit workflow queues or execution records.
- ManyMind rooms, sleeves, source packets, or meeting state.
- Siri wake-word handling, speech-to-text, or device microphone permissions.
- Autonomous background actions.

Pack-owned capability is still routed through CommandDeck core for intake,
classification, permission, approval, runner boundaries, and records. Pack does
not mean "outside the engine"; it means "outside the built-in capability set."

## Code Editing Boundary

If editing code, the user works from the PC in Codex or the normal local
development toolchain. CommandDeck may help prepare the workspace, summarize
state, start local services, or open tools, but it does not replace Codex as the
coding interface.

This is especially important for SourceGrid and similar repos where local
services such as Puma, Sidekiq, databases, simulators, browser sessions, and
local credentials live on the PC runner.

## Current Boundary

The default MVP path still defines contracts, docs, and fixtures. Current
preview execution is limited to:

- built-in exact local read-only actions;
- built-in approval-gated local control actions.

Workspace-specific mutable automation still belongs in command packs and needs a
later owner-pack execution contract.

SourceGrid attachment is represented as local, non-sensitive metadata only.
CommandDeck may report payment-method readiness, but SourceGrid remains the
billing and payment method owner.

SourceGrid credits must only gate AppRelay or other SourceGrid-billed runtime
routes. Non-reasoning local command flow remains available without credits.
