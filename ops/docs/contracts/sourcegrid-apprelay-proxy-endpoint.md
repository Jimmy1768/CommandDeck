# SourceGrid AppRelay Proxy Endpoint Contract

CommandDeck uses SourceGrid full proxy for V1 AppRelay reasoning.

The machine-readable contract is:

- `contracts/sourcegrid/apprelay-reasoning-proxy-endpoint.schema.json`

## Endpoint

```text
POST /commanddeck/apprelay/reasoning
```

Status: contract-only. Phase 1 network calls remain disabled.

SourceGrid owns this endpoint. CommandDeck is the caller. SourceGrid validates
workspace/account/user scope, payment readiness, spend policy, credits, runtime
entitlement, and active pack scope before calling AppRelay.

## CommandDeck Request

CommandDeck sends:

- `request_identity`;
- `sourcegrid_attachment_ref`;
- `active_local_context`;
- `authority_constraints`;
- `runtime_task`;
- `required_output_schema`;
- `user_utterance`.

CommandDeck must not send:

- provider or model names;
- AppRelay API keys or tokens;
- payment card data;
- Stripe secrets;
- shell commands;
- scripts;
- raw SQL;
- approval decisions;
- execute-now flags;
- live memory activation.

## SourceGrid Validation

SourceGrid must validate before AppRelay:

- workspace attachment status;
- account status;
- user authorization;
- payment method readiness;
- AppRelay spend policy;
- SourceGrid credit availability;
- AppRelay runtime entitlement;
- active pack scope against workspace policy;
- idempotency key replay policy.

SourceGrid then binds scope proof and calls AppRelay.

## Response

Allowed statuses:

- `ok`;
- `blocked_sourcegrid_proxy_unavailable`;
- `blocked_sourcegrid_scope_missing`;
- `blocked_sourcegrid_scope_stale`;
- `blocked_apprelay_not_entitled`;
- `blocked_apprelay_spend_unavailable`;
- `blocked_active_pack_scope_invalid`;
- `blocked_apprelay_response_invalid`;
- `blocked_rate_limited`;
- `blocked_idempotency_conflict`.

An `ok` response includes the bounded AppRelay response. CommandDeck must still
validate that response and revalidate the resolved intent before routing.

Blocked responses include:

- `status`;
- `request_id`;
- `reason`;
- `user_message`;
- `retryable`.

## User-Facing Behavior

CommandDeck fails closed when SourceGrid blocks the proxy call. It should tell
the user why reasoning is unavailable and offer exact local actions only when
those actions remain locally permitted.
