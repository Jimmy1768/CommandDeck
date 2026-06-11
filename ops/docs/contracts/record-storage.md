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
