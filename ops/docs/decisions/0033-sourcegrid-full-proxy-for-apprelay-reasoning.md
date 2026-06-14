# 0033: SourceGrid Full Proxy For AppRelay Reasoning

Status: Accepted.

## Context

Decision 0032 established that CommandDeck should not store a long-lived
AppRelay signing secret and that AppRelay reasoning must be bound to SourceGrid
workspace/account entitlement and billing scope.

There are two possible V1 broker patterns:

- SourceGrid issues a short-lived token, then CommandDeck calls AppRelay.
- SourceGrid proxies the full AppRelay call.

## Decision

V1 uses SourceGrid full proxy.

CommandDeck sends the SourceGrid runtime reasoning request to SourceGrid. SourceGrid
validates attachment, account, user, entitlement, payment readiness, spend
policy, credits, and active pack scope. SourceGrid then binds scope proof and
calls AppRelay. AppRelay returns bounded reasoning to SourceGrid, and SourceGrid
returns it to CommandDeck.

CommandDeck does not receive AppRelay credentials or short-lived AppRelay
tokens in V1.

## Lifecycle

1. CommandDeck detects capable-lane reasoning is needed.
2. CommandDeck builds the SourceGrid runtime reasoning request.
3. CommandDeck sends it to SourceGrid.
4. SourceGrid validates workspace/account/user/payment/credit/runtime
   entitlement.
5. SourceGrid validates active pack scope against workspace policy.
6. SourceGrid binds scope proof and calls AppRelay.
7. AppRelay selects provider/model and returns bounded reasoning.
8. SourceGrid returns the response to CommandDeck.
9. CommandDeck revalidates the response before routing.

## Consequences

- Billing, entitlement, and runtime spend policy stay centralized in
  SourceGrid.
- The local CLI has no AppRelay secret storage problem.
- AppRelay receives a cleaner SourceGrid runtime request from a trusted SourceGrid
  boundary.
- Token issuance can be deferred until there is a clear need for direct local
  calls.

## Non-Goals

- No direct CommandDeck-to-AppRelay V1 call path.
- No AppRelay provider/model selection in CommandDeck.
- No execution authority for AppRelay.
- No live memory activation from AppRelay responses.
