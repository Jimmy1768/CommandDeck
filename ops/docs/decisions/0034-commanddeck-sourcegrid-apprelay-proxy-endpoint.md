# 0034: CommandDeck SourceGrid AppRelay Proxy Endpoint

Status: Accepted.

## Context

Decision 0033 selected SourceGrid full proxy for V1 AppRelay reasoning. The
next boundary is the concrete CommandDeck-to-SourceGrid endpoint contract.

## Decision

CommandDeck uses this contract-only endpoint:

```text
POST /commanddeck/apprelay/reasoning
```

CommandDeck sends its internal-ops reasoning request to SourceGrid without
AppRelay credentials, provider names, model names, shell, scripts, SQL,
approval decisions, execute-now flags, or live memory activation fields.

SourceGrid validates workspace/account/user scope, payment readiness, spend
policy, credits, AppRelay runtime entitlement, active pack scope, and
idempotency before calling AppRelay.

SourceGrid later accepted this boundary as its own contract and added a
separate runtime broker/probe foundation. CommandDeck therefore adds only a
contract-only request preview in this phase. The preview does not call
SourceGrid or AppRelay.

The endpoint contract is:

- `contracts/sourcegrid/apprelay-reasoning-proxy-endpoint.schema.json`

## Fail-Closed Statuses

SourceGrid may return:

- `blocked_sourcegrid_proxy_unavailable`;
- `blocked_sourcegrid_scope_missing`;
- `blocked_sourcegrid_scope_stale`;
- `blocked_apprelay_not_entitled`;
- `blocked_apprelay_spend_unavailable`;
- `blocked_active_pack_scope_invalid`;
- `blocked_apprelay_response_invalid`;
- `blocked_rate_limited`;
- `blocked_idempotency_conflict`.

CommandDeck must not guess or route after these statuses. It may offer exact
local actions only if local policy allows them.

## Consequences

- The SourceGrid/AppRelay boundary is explicit before implementation.
- CommandDeck remains free of AppRelay credentials.
- Billing and entitlement checks stay centralized.
- User-facing blocked cases can be deterministic.

## Non-Goals

- No network implementation in this decision.
- No AppRelay implementation.
- No provider/model selection in CommandDeck.
