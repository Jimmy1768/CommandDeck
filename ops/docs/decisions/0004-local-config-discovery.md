# 0004: Local Config Discovery

Status: Accepted for Phase 1 prototype.

## Context

CommandDeck needs a stable way to discover the default command pack and action
record directory without hardcoding all choices into the CLI. This must not
create a path for secrets, provider keys, or implicit writes.

## Decision

Support a repo-relative JSON config file. The default lookup path is:

```text
commanddeck.config.json
```

If no default config exists, the shell uses safe built-in defaults. A tracked
example config lives at:

```text
commanddeck.config.example.json
```

Explicit config selection is available with:

```sh
npm run command:local -- --config commanddeck.config.example.json "What is my next SourceGrid task?"
```

Phase 1 config validation requires:

- `schema_version` is `0.1`;
- `default_command_pack` is repo-relative;
- `default_record_dir` is repo-relative and inside the repo;
- `default_write_records` is `false`;
- config fields for provider keys, secrets, env values, or execute-now are
  forbidden.

## Consequences

- Local defaults can be configured without changing code.
- Record writes remain opt-in by CLI flag.
- Secrets and provider configuration remain out of scope.
- Future partner or outside-repo command-pack folders still need a separate
  decision.
