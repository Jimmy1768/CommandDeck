# 0032: AppRelay Scope Proof And SourceGrid Broker

Status: Accepted.

## Context

CommandDeck can ask AppRelay for capable-lane command-routing reasoning, but
AppRelay must not receive execution authority, approval authority, model
selection input, or live memory activation authority.

The remaining issue is authorization. AppRelay needs proof that a CommandDeck
internal-ops request is attached to a SourceGrid workspace that may consume
SourceGrid-billed AppRelay runtime.

## Decision

CommandDeck AppRelay reasoning requests must carry a scoped request envelope
with:

- signed or broker-validated request identity;
- SourceGrid organization/account/workspace/user scope;
- AppRelay runtime entitlement;
- issue and expiry timestamps;
- attachment version or scope hash;
- active pack/control folder identity and digest;
- adapter, surface, device, and session metadata where available;
- authority constraints;
- runtime task metadata and required output schema.

V1 should prefer SourceGrid-brokered AppRelay calls. The local CommandDeck CLI
must not store a long-lived AppRelay signing secret.

The proposed runtime mode is:

```text
sourcegrid_internal_ops
```

AppRelay may rename this later, but CommandDeck needs a stable field that
separates internal ops requests from normal external assistant tenant traffic.

## Authorization-Critical Fields

- `client_key`
- `client_type`
- `runtime_mode`
- `purpose`
- `request_id`
- `idempotency_key`
- SourceGrid organization/account/workspace/user IDs
- AppRelay runtime entitlement
- `issued_at`
- `expires_at`
- `attachment_scope_hash`
- active pack/control folder identity and digest
- authority constraints
- route work type
- required output schema

## Audit Or Routing Metadata

- actor, device, and session references
- attachment version
- adapter
- surface hint
- device code
- local CommandDeck package version
- reasoning task
- escalation reason
- latency, cost, risk, and sensitivity class
- task metadata and constraints

## Rejection Statuses

AppRelay should fail closed with one of:

- `rejected_missing_scope_proof`
- `rejected_stale_scope_proof`
- `rejected_not_entitled`
- `rejected_invalid_client_identity`
- `rejected_scope_hash_mismatch`

## Consequences

- SourceGrid remains the broker for entitlement and billing readiness.
- CommandDeck does not hold long-lived AppRelay secrets.
- AppRelay can distinguish CommandDeck internal ops requests from tenant chat.
- Missing or stale scope proof blocks reasoning instead of degrading into an
  unsafe best-effort response.

## Non-Goals

- No AppRelay implementation in CommandDeck.
- No provider/model names in CommandDeck requests.
- No AppRelay execution authority.
- No live memory activation from candidate memory.
