# 0027: Pack Rejection Audit Records

Status: Accepted.

## Context

Custom pack rejection is not always a hostile violation. Most early failures
will be authoring mistakes: unknown routes, missing fields, unsafe sources, or
confusion about what CommandDeck is allowed to run.

The previous decision requires a `pack_command_rejected` audit event. V1 needs a
minimal local implementation without changing the no-write-by-default behavior.

## Decision

CommandDeck supports opt-in local pack rejection audit records.

Default storage:

```text
.commanddeck/audit/pack-rejections/
```

The write is explicit:

```sh
npm run command:local -- pack:open --command-pack path/to/custom.cdeck-pack.json --write-audit
```

Audit events use `contracts/records/pack-rejection-audit.schema.json`.

The V1 event records:

- event id;
- timestamp;
- rejection phase;
- command pack path;
- resolved command pack path when used;
- pack id and owner when readable;
- command ids when readable;
- sanitized validation errors;
- redaction policy.

Audit records must not store script contents, env values, secrets, provider
tokens, or raw authorization headers.

## Consequences

- Users can debug rejected custom packs without guessing.
- CommandDeck still does not write local files unless explicitly asked.
- SourceGrid Labs can later surface these local diagnostics as pack authoring
  feedback.

## Non-Goals

- No central audit service.
- No automatic upload to SourceGrid.
- No execution-time script audit until a script-capable runner policy exists.
