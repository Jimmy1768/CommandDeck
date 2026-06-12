# Record Storage Contract

Phase 1 local action records use one JSON file per record.

Default directory:

```text
records/actions/
```

Default behavior:

```text
print-only, no file write
```

Write behavior:

```sh
npm run command:local -- --write-record "What is my next SourceGrid task?"
```

Rules:

- record writes require an explicit local flag;
- record directories must be repo-relative;
- record directories must stay inside the repo;
- generated action record JSON is ignored by git;
- action records are not execution records;
- approval-required commands remain blocked from execution.

## Pack Rejection Audit Records

Custom pack rejection audits use one JSON file per event under:

```text
.commanddeck/audit/pack-rejections/
```

Default behavior:

```text
print-only, no audit file write
```

Write behavior:

```sh
npm run command:local -- pack:open --command-pack path/to/custom.cdeck-pack.json --write-audit
```

Rules:

- audit writes require the explicit `--write-audit` flag;
- audit directories must be repo-relative;
- audit directories must stay inside the repo;
- generated audit JSON is ignored by git;
- audit events must not store script contents, env values, secrets, provider
  tokens, or raw authorization headers.
