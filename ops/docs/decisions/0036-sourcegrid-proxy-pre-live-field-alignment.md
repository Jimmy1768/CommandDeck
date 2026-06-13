# 0036: SourceGrid Proxy Pre-Live Field Alignment

Status: Accepted.

## Context

SourceGrid reviewed CommandDeck commit `f478382` and accepted it for
contract-only smoke. SourceGrid marked it amend-needed before any future live
call gate.

The smoke boundary remains valid: no network call, no direct AppRelay
credentials, no provider/model selection, no execution authority, and no memory
activation.

## Decision

Before live dispatch, CommandDeck uses the SourceGrid-aligned request shape:

- `active_local_context.pack_ref` is canonical instead of `active_pack_ref`;
- `sourcegrid_attachment_ref` carries `attachment_issued_at` and
  `attachment_expires_at`;
- `user_utterance` is structured as `{ text, locale, language }`;
- `required_output_schema` is structured as `{ kind, ref }`;
- forbidden provider/model/token fields are rejected at any nesting depth.

The smoke path remains contract-only and continues to report:

```text
network_call_status: not_sent_contract_only
```

## Consequences

- CommandDeck's preview shape is closer to SourceGrid's guard-layer
  expectations.
- Live dispatch remains blocked until SourceGrid guard corrections are accepted.
- No response status changes are required.

## Non-Goals

- No live SourceGrid endpoint call.
- No AppRelay call.
- No provider/model selection in CommandDeck.
- No execution or memory activation authority.
