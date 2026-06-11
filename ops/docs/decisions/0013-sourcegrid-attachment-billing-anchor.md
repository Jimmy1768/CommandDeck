# 0013: SourceGrid Attachment And Billing Anchor

Status: Accepted for Phase 1 prototype.

## Context

AppRelay is a link in the CommandDeck chain when model reasoning, generated
audio, or runtime capability is needed. AppRelay usage can cost money. That
means CommandDeck cannot treat an arbitrary local command-pack repo as the
account, entitlement, or billing authority.

At the same time, command packs and scripts should still live in the owner repo
that understands the user's workspace, such as `sourcegrid-labs` for
SourceGrid.

## Decision

CommandDeck attaches to a SourceGrid workspace for identity, entitlement,
payment-method readiness, and AppRelay billing policy.

Owner repos are command-pack sources only. They are not the billing anchor.

The first CLI surface is:

```sh
command-deck sourcegrid:status
```

In Phase 1 this is local and contract-only. It validates attachment metadata and
reports whether AppRelay spend would be allowed. It does not authenticate,
charge, call AppRelay, call SourceGrid, or store payment data.

## Consequences

- CommandDeck needs a CLI because attachment, status, and future setup are
  account-level concerns, not just repo-local command execution.
- Payment method state is surfaced as SourceGrid readiness state, not as raw
  payment details in CommandDeck.
- AppRelay routes must remain disabled unless SourceGrid attachment, payment
  method, and credit checks pass.
- SourceGrid credits gate AppRelay and other SourceGrid-billed runtime routes
  only. They do not gate voice capture, platform TTS, deterministic local
  commands, local reads, local drafts, or permitted local scripts.
- `sourcegrid-labs` remains the SourceGrid command-pack owner repo, but not the
  CommandDeck account of record.

## Non-Goals

- No raw card or provider payment data in local config.
- No real billing calls in Phase 1.
- No AppRelay spend in Phase 1.
- No external SourceGrid attachment API call in Phase 1.
