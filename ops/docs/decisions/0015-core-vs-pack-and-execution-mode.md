# 0015: Core Versus Pack And Execution Mode

Status: Accepted

## Context

CommandDeck needed a clearer product model for deciding where a new capability
belongs.

Two different questions were getting mixed together:

- is this a generic built-in CommandDeck capability or a workspace-specific
  capability?
- is this an exact local action or a capable action that needs AppRelay?

Without separating those questions, CommandDeck risks oscillating between two
bad extremes:

- trying to be completely generic and therefore not useful enough for real
  workspace automation;
- absorbing SourceGrid-specific or user-specific routines into core and
  becoming a bloated command catalog.

## Decision

CommandDeck uses two orthogonal axes.

### Capability Source

- `core`: generic built-in actions and engine behavior owned by CommandDeck.
- `pack`: workspace-specific routines owned by a company, partner, or user.

### Execution Mode

- exact/local/deterministic
- capable/AppRelay-mediated

These axes are independent. A command may be:

- core + exact/local
- pack + exact/local
- core + AppRelay-mediated
- pack + AppRelay-mediated

Core continues to own:

- adapter intake
- classification
- permission checks
- approval rules
- runner boundaries
- action records
- safety policy

Pack capability still runs through CommandDeck core. `pack` means the routine is
customized and owned outside the built-in capability set, not outside the
engine.

## Platform Direction

The first core capability set is Apple-first.

This is intentional. Siri and Shortcuts provide the fastest thin invocation
layer, so CommandDeck may ship a default Apple-PC built-in action set before it
supports equivalent built-ins for every platform.

Examples of valid early core actions:

- open
- play
- pause
- stop
- check status
- open app or URL
- generic repo or process status checks

Examples of pack-owned capability:

- SourceGrid workspace routines
- personal local operating scripts
- repo-specific service orchestration
- company-specific dashboards, work modes, and workflows

## AppRelay Rule

AppRelay is part of execution mode, not a substitute for the core/pack split.

Use AppRelay only when a command needs reasoning, ambiguity handling,
summarization, generation, or another billed runtime capability. Exact local
commands should stay deterministic when possible, whether they come from core
or from a pack.

## Consequences

- CommandDeck is not just "control the computer"; it uses the computer as the
  execution surface for both built-in and workspace-specific automation.
- Core may grow a reusable built-in action set without violating the architecture.
- SourceGrid-specific and user-specific routines should stay in owner packs
  rather than in CommandDeck core.
- Future mutable workspace automation should default to pack ownership unless
  the action is clearly generic and reusable across users.
- Product scope decisions should first answer `core or pack`, then answer
  `exact/local or AppRelay-mediated`.
