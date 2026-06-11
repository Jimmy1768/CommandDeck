# 0005: Adapter Request File Ingestion

Status: Accepted for Phase 1 prototype.

## Context

CommandDeck needs a bridge between the Siri/Shortcuts adapter contract and the
local shell before any private endpoint or device integration exists.

## Decision

Support repo-relative adapter request JSON files with:

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/apple_shortcuts.next_task.json
```

The request file follows the Siri/Shortcuts adapter contract and is validated
before command classification.

Phase 1 validation requires:

- adapter is `apple_shortcuts`, `google_voice`, or `local_cli`;
- actor reference is present;
- command text is present;
- voice adapter requests include a generic `surface_hint`, such as `phone`,
  `watch`, `glasses`, or `computer`;
- voice adapter requests include `target_runner: "command"`;
- requested output is `spoken_summary`, `display_text`, or `json`;
- request file path is repo-relative;
- token, authorization, env, provider key, password, and secret fields are
  forbidden.

## Consequences

- Siri/Shortcuts-shaped payloads can be tested locally.
- No server endpoint or platform integration is introduced.
- Voice invocation still does not count as approval.
