# 0035: SourceGrid AppRelay Proxy Smoke Path

Status: Accepted.

## Context

SourceGrid accepted the CommandDeck AppRelay proxy endpoint contract and added
a runtime broker/probe foundation. CommandDeck still must not call SourceGrid
or AppRelay while Phase 1 network calls are disabled.

SourceGrid later accepted this path for contract-only smoke, but required
pre-live alignment before any live-call gate:

- canonical `active_local_context.pack_ref`;
- attachment freshness fields;
- structured `user_utterance`;
- structured `required_output_schema`;
- nested forbidden-field tests.

The next safe step is a real CommandDeck command path that proves the local
runner can build the accepted SourceGrid proxy request shape.

## Decision

Use the existing AppRelay-reasoning fixture command as the first smoke path:

```text
mvp.apprelay_changes_today -> apprelay.summary
```

When this command runs, CommandDeck continues to answer from the local fixture.
It also attaches `result.data.sourcegrid_apprelay_proxy_smoke` to the action
record with:

- endpoint metadata;
- `network_call_status: not_sent_contract_only`;
- `sourcegrid_contract_status: accepted_contract_only`;
- the SourceGrid proxy request preview;
- validation errors, if any.

CommandDeck also validates SourceGrid blocked and ok proxy responses as local
fixtures. An ok response remains revalidation-required; it does not route or
execute by itself.

## Consequences

- The SourceGrid proxy request shape is exercised by a real command path.
- No network call is introduced.
- No AppRelay spend is introduced.
- The fixture answer remains stable for MVP evals.
- Future live wiring has a concrete action-record location to replace or
  extend.

## Non-Goals

- No live SourceGrid endpoint call.
- No AppRelay call.
- No execution authority.
- No memory activation.
