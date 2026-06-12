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

CommandDeck provides:

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

See:

- `contracts/apprelay/commanddeck-reasoning-request.schema.json`

## Response

AppRelay may return only:

- `resolved_intent`;
- `concept_checking_question`;
- `unsupported`;
- `memory_candidate`.

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
