# 0031: AppRelay SourceGrid Runtime Client Contract

Status: Accepted.

## Context

CommandDeck may call AppRelay when fast-lane deterministic handling cannot
resolve a command safely. This is not a normal tenant assistant conversation.
It is a SourceGrid runtime tool asking for bounded reasoning to support command
routing.

SourceGrid workspace/account context still matters for entitlement, billing,
and memory scope, but the client type must identify the request as CommandDeck
SourceGrid runtime.

## Decision

CommandDeck AppRelay calls use:

```text
client_type: internal_ops_tool
client_key: commanddeck
purpose: command_routing_reasoning
```

CommandDeck sends reasoning purpose, constraints, risk, sensitivity, cost class,
active command context, and required output schema. CommandDeck does not send a
model name. AppRelay owns model/provider selection and any internal escalation
between lower-cost and stronger models.

AppRelay output grants no execution authority. It may only return:

- resolved intent;
- concept-checking question;
- unsupported response;
- memory candidate requiring user confirmation.

CommandDeck must revalidate the response before routing.

## Consequences

- AppRelay can route CommandDeck reasoning differently from tenant chat traffic.
- Billing and memory scope still attach to the SourceGrid workspace/account.
- Model choice remains centralized in AppRelay.
- CommandDeck keeps execution and approval authority.

## Non-Goals

- No CommandDeck-owned model routing.
- No AppRelay execution authority.
- No live memory activation from reasoning responses.
