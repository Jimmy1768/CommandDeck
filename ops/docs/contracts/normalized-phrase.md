# Normalized Phrase Contract

`normalized_phrase` is deterministic transcript cleanup for fast-lane memory
matching.

The machine-readable contract lives at:

- `contracts/records/normalized-phrase.schema.json`

## Rule

`normalized_phrase` stores and compares lowercase transcript text.

It removes capture noise. It does not infer meaning.

## Allowed V1 Transforms

- lowercase;
- trim outer whitespace;
- collapse repeated internal whitespace;
- remove punctuation;
- remove speech fillers such as `uh` and `um`;
- remove leading politeness such as `please`.

## Forbidden V1 Transforms

- synonym matching;
- semantic similarity;
- embedding similarity;
- LLM paraphrase matching;
- action verb rewrite;
- target word removal;
- scope word removal;
- risk word removal;
- timing word removal;
- environment word removal;
- article removal.

## Examples

`Open Ops Dashboard.` becomes:

```text
open ops dashboard
```

`Please open, uh, Ops Dashboard` becomes:

```text
open ops dashboard
```

`Open the Ops Dashboard` stays:

```text
open the ops dashboard
```

The article `the` is preserved in V1 because removing articles can accidentally
change target identity in user-defined names.

## Non-Equivalent Examples

These must not match through `normalized_phrase`:

- `start puma` and `restart puma`
- `open dashboard` and `open billing dashboard`
- `check sidekiq` and `restart sidekiq`
- `deploy staging` and `deploy production`
- `send draft` and `send message`

If broader interpretation is needed, CommandDeck should escalate to
`capable_lane` or ask a concept-checking question. It should not make memory
matching semantic.
