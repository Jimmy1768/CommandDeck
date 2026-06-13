# AppRelay CommandDeck Reasoning Contract

CommandDeck uses AppRelay as an internal ops client, not as a normal tenant chat
surface.

The client identity is:

```text
client_type: internal_ops_tool
client_key: commanddeck
purpose: command_routing_reasoning
```

SourceGrid workspace attachment still supplies entitlement, billing, and memory
scope context. Client type says what kind of AppRelay request this is.

## Request

CommandDeck sends structured task metadata, not a model name.

The request envelope has five groups:

- `request_identity`;
- `sourcegrid_scope_proof`;
- `active_local_context`;
- `authority_constraints`;
- `runtime_task`.

Authorization-critical fields:

- `client_key`;
- `client_type`;
- `runtime_mode`;
- `purpose`;
- `request_id`;
- `idempotency_key`;
- SourceGrid organization/account/workspace/user IDs;
- AppRelay runtime entitlement;
- proof issue/expiry timestamps;
- attachment scope hash;
- active pack/control folder identity and digest;
- authority constraints;
- route work type and required output schema.

Audit or routing metadata:

- actor, device, and session references;
- attachment version;
- adapter;
- surface hint;
- device code;
- local CommandDeck package version;
- reasoning task;
- escalation reason;
- latency, cost, risk, and sensitivity class;
- task metadata and constraints.

CommandDeck provides runtime task metadata such as:

- reasoning task, such as `intent_resolution`;
- escalation reason, such as `ambiguous_intent`;
- active command/pack context;
- user utterance;
- risk tier;
- sensitivity class;
- latency and cost class;
- required output schema;
- uncertainty behavior: return a concept-checking question instead of guessing.

AppRelay owns provider/model selection, fallback, retry, and reasoning depth.

## Transport

V1 uses SourceGrid full proxy for AppRelay reasoning. The local CommandDeck CLI
must not store a long-lived AppRelay signing secret, and it should not receive
a short-lived AppRelay token in V1.

SourceGrid is already the authority for workspace attachment, entitlement,
billing readiness, and AppRelay spend policy. A brokered call lets SourceGrid
issue or validate short-lived scope proof before AppRelay accepts billable
reasoning.

The lifecycle is:

1. CommandDeck detects that capable-lane reasoning is needed.
2. CommandDeck builds an internal-ops reasoning request.
3. CommandDeck sends the request to SourceGrid.
4. SourceGrid validates workspace, account, user, entitlement, spend policy,
   credits, and active pack scope.
5. SourceGrid binds scope proof to the request.
6. SourceGrid calls AppRelay.
7. AppRelay chooses provider/model and returns bounded reasoning.
8. SourceGrid returns the response to CommandDeck.
9. CommandDeck revalidates the response before routing.

Direct CommandDeck-to-AppRelay calls remain disabled until a separate
short-lived credential contract is accepted.

See:

- `contracts/apprelay/sourcegrid-proxied-reasoning-lifecycle.schema.json`

See:

- `contracts/apprelay/commanddeck-reasoning-request.schema.json`

## Response

AppRelay may return only:

- `resolved_intent`;
- `concept_checking_question`;
- `unsupported`;
- `memory_candidate`;
- `rejected`.

Allowed rejection statuses:

- `rejected_missing_scope_proof`;
- `rejected_stale_scope_proof`;
- `rejected_not_entitled`;
- `rejected_invalid_client_identity`;
- `rejected_scope_hash_mismatch`.

CommandDeck must revalidate any resolved intent against the active pack/core
commands, route policy, permission policy, missing dependency policy, approval
policy, and action requirements before routing.

Candidate memory is not live runtime memory. Any memory writeback requires user
confirmation before it can affect future fast-lane behavior.

See:

- `contracts/apprelay/commanddeck-reasoning-response.schema.json`

## Forbidden

AppRelay responses must not contain:

- shell commands;
- scripts;
- raw SQL;
- approval decisions;
- execute-now flags;
- new route definitions;
- active memory writes.
