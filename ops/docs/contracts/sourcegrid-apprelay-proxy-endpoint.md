# SourceGrid AppRelay Proxy Endpoint Contract

CommandDeck uses SourceGrid full proxy for V1 AppRelay reasoning.

The machine-readable contract is:

- `contracts/sourcegrid/apprelay-reasoning-proxy-endpoint.schema.json`

## Endpoint

```text
POST /commanddeck/apprelay/reasoning
```

Status: guarded `sourcegrid_dev` dispatch enabled in SourceGrid.

SourceGrid owns this endpoint. CommandDeck is the caller. SourceGrid validates
workspace/account/user scope, payment readiness, spend policy, credits, runtime
entitlement, and active pack scope before calling AppRelay.

SourceGrid accepted this boundary in its own contract:

- `/Users/jimmy1768/Projects/sourcegrid-labs/company/contracts/commanddeck_apprelay_reasoning_proxy_endpoint.schema.json`

SourceGrid also accepted a runtime broker slice that can build signed
SourceGrid-to-AppRelay requests. The live CommandDeck-to-SourceGrid endpoint
still requires guarded account, payment, credit, scope, and idempotency checks.

## CommandDeck Request

CommandDeck sends:

- `request_identity`;
- `sourcegrid_attachment_ref`;
- `active_local_context`;
- `authority_constraints`;
- `runtime_task`;
- `required_output_schema`;
- `user_utterance`.

For `request_identity.runtime_mode: sourcegrid_dev`, CommandDeck also
sends:

- `internal_actor_ref`;
- `internal_dev_reason`.

Live-gate field conventions:

- `active_local_context.pack_ref` is canonical; do not use
  `active_pack_ref` for the SourceGrid proxy request.
- `sourcegrid_attachment_ref` includes `attachment_issued_at` and
  `attachment_expires_at` so live dispatch can fail closed on stale attachment
  proof.
- `user_utterance` is an object with `text`, `locale`, and `language`.
- `required_output_schema` is an object with `kind: json_schema_ref` and `ref`.

Internal dev field conventions:

- `sourcegrid_dev` is SourceGrid-company-funded development/testing,
  not customer-billed runtime.
- Creator/admin dogfood should use `sourcegrid_dev` when exercising the real
  SourceGrid product path. It does not require the public SourceGrid
  subscription fee and must not use customer retail AppRelay/LLM runtime
  pricing.
- `sourcegrid_dev` still requires audit plus budget or rate-limit controls so
  company-funded runtime cost remains visible and bounded.
- SourceGrid derives the stable audit/rate-limit actor from the resolved
  `AdminAccount`; `internal_actor_ref` is caller-supplied context only.
- Customer live mode remains `sourcegrid_prod` and still blocks on
  payment readiness.
- Internal dev mode may dispatch through SourceGrid after its guard,
  authority, scope, and budget checks pass. If transport or configuration is
  unavailable, SourceGrid still returns `blocked_sourcegrid_proxy_unavailable`.

Preview the local CommandDeck request shape without sending a network call:

```sh
npm run command:local -- sourcegrid:apprelay-proxy-preview --config commanddeck.config.example.json --request-file evals/fixtures/adapter_requests/apple_shortcuts.next_task.json
```

The local CommandDeck preview returns
`network_call_status: not_sent_contract_only`. SourceGrid's own endpoint may
perform guarded `sourcegrid_dev` dispatch when called in an environment with the
required runtime configuration.

The first command-level smoke path is:

```text
mvp.apprelay_changes_today -> apprelay.summary
```

In Phase 1 this command still answers from a local fixture. Its action record
also includes `result.data.sourcegrid_apprelay_proxy_smoke` so tests can prove
CommandDeck can build the accepted SourceGrid request shape without dispatching
network traffic.

CommandDeck must not send:

- provider or model names;
- provider/model aliases such as `model_key`, `model_name`,
  `model_registry_key`, or `provider_model`;
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

Creator/admin usage should still dogfood through SourceGrid for real product
flow once the local CLI smoke path is stable. The billing mode is the
difference: creator/admin dogfood is internal company-funded `sourcegrid_dev`,
while paying customer usage is `sourcegrid_prod`.
