# SourceGrid Attachment Contract

CommandDeck must attach to a SourceGrid workspace before any path can spend
money through AppRelay. The declared owner repo is not the account of record.
It is only a source for command packs and local workspace scripts.

## Ownership

- SourceGrid owns identity, entitlement, billing profile, and payment method
  state.
- SourceGrid Labs web console owns the normal user-facing pack management
  surface for SourceGrid usage.
- CommandDeck owns local command intake, permission checks, routing contracts,
  adapter responses, and action records.
- Owner repos such as `sourcegrid-labs` own command packs and workspace
  routines.
- AppRelay owns LLM/runtime capability and may create billable usage only after
  SourceGrid attachment and payment checks pass.

SourceGrid Labs web console may select or display packs through the bridge
contract, but the local CommandDeck runner must still validate and apply one
active pack locally. See:

- `contracts/bridge/sourcegrid-console-bridge.schema.json`
- `ops/docs/contracts/sourcegrid-console-bridge.md`

## Local Contract

`sourcegrid_attachment` in `commanddeck.config.example.json` is contract-only in
Phase 1:

```json
{
  "schema_version": "0.1",
  "status": "contract_only",
  "sourcegrid_workspace_ref": "workspace_sourcegrid_fixture",
  "sourcegrid_account_ref": "account_sourcegrid_fixture",
  "billing_owner": "sourcegrid_workspace",
  "payment_method_state": "missing",
  "payment_method_label": null,
  "apprelay_spend_policy": "disabled_until_payment_verified",
  "command_pack_owner_repos": ["sourcegrid-labs"]
}
```

CommandDeck must not store raw payment details, provider keys, Stripe secrets,
payment tokens, card numbers, CVC/CVV values, or environment secrets. A future
SourceGrid API may return non-sensitive payment readiness state or a masked
display label, but payment method storage stays in SourceGrid.

## CLI

Phase 1 provides a local status command:

```sh
npm run command:local -- sourcegrid:status --config commanddeck.config.example.json
```

The command validates local attachment metadata and reports whether AppRelay
spend is allowed. It does not call SourceGrid, AppRelay, Stripe, GitHub, or any
external service.

## AppRelay Client Contract

CommandDeck uses AppRelay as an internal ops client, not a normal tenant chat
surface.

```text
client_type: internal_ops_tool
client_key: commanddeck
purpose: command_routing_reasoning
```

SourceGrid workspace/account context still supplies entitlement, billing, and
memory scope. AppRelay owns model/provider selection. CommandDeck sends
reasoning purpose and constraints, not a model name.

CommandDeck AppRelay responses must not grant execution authority, approval
authority, new route definitions, or live memory activation. Memory writeback
requires user confirmation.

## AppRelay Scope Proof

V1 routes CommandDeck AppRelay reasoning through SourceGrid as a full proxy.
The local CommandDeck CLI must not store a long-lived AppRelay signing secret
and should not receive a short-lived AppRelay token in V1.

Before AppRelay accepts a CommandDeck internal-ops reasoning request, the
request must prove:

- CommandDeck client identity: `internal_ops_tool` / `commanddeck`;
- runtime mode: `sourcegrid_internal_ops`;
- purpose: `command_routing_reasoning`;
- SourceGrid organization/account/workspace/user scope;
- entitlement to consume SourceGrid-billed AppRelay runtime;
- issue and expiry timestamps;
- attachment version or scope hash;
- active pack/control folder identity and digest;
- authority constraints: no execution, no live memory activation, approved
  active memory reads only, and candidate-only memory writeback after explicit
  user confirmation.

AppRelay should reject requests with missing, stale, invalid, or not-entitled
scope proof instead of attempting best-effort reasoning.

SourceGrid proxy responsibilities:

- receive CommandDeck's internal-ops reasoning request;
- validate workspace attachment, account, user, entitlement, spend policy, and
  credits;
- validate active pack scope against workspace policy;
- bind SourceGrid scope proof;
- call AppRelay;
- return AppRelay's bounded response to CommandDeck.

CommandDeck remains responsible for response schema validation and local
revalidation before routing.

The proxy endpoint contract is:

- `contracts/sourcegrid/apprelay-reasoning-proxy-endpoint.schema.json`

CommandDeck can build a local contract-only request preview for this endpoint,
but it must not send the request while Phase 1 network calls are disabled:

```sh
npm run command:local -- sourcegrid:apprelay-proxy-preview --config commanddeck.config.example.json --request-file evals/fixtures/adapter_requests/apple_shortcuts.next_task.json
```

## Spend Gate

AppRelay spend requires all of:

- `status: "attached"`;
- `billing_owner: "sourcegrid_workspace"`;
- `payment_method_state: "verified"`;
- `apprelay_spend_policy: "enabled_after_payment_verified"`.

Anything else must be treated as no-spend contract-only mode.

## Credit Exhaustion

If credits are exhausted or payment readiness is missing, CommandDeck must block
only SourceGrid-billed runtime routes:

- AppRelay reasoning;
- AppRelay-generated summaries;
- AppRelay-generated audio;
- any future SourceGrid-billed runtime route.

The following must remain available when locally permitted:

- Siri, Shortcuts, Google voice, or other capture surfaces;
- platform TTS speaking local response text;
- exact local commands;
- local read-only checks;
- local draft-only routines;
- permitted local scripts.

The user-facing response should degrade gracefully, for example: "Credits are
unavailable, so I cannot reason over the logs. I can still open the logs or run
the fixed health check."
