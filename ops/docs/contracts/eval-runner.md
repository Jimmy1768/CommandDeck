# Eval Runner Contract

The eval runner executes local fixture-backed cases and compares actual local
shell output against expected contract fields.

Default run:

```sh
npm run eval:mvp
```

Safety run:

```sh
npm run eval:safety
```

Approval decision run:

```sh
npm run eval:approval
```

Optional report write:

```sh
npm run eval:mvp -- --write-report --report evals/reports/mvp.slice1.latest.json --overwrite
```

## Rules

- Eval suite paths must be repo-relative.
- Reports may only be written under `evals/reports/`.
- Generated JSON reports are ignored by git.
- Eval runs do not write action records.
- Eval runs do not call AppRelay, OperatorKit, ManyMind, or platform adapters.
- A failed eval exits non-zero.
