# Verification Gate Contract

The Phase 1 verification gate is:

```sh
npm run verify
```

It must run:

- `npm test`;
- `npm run validate:fixtures`;
- `npm run eval:mvp`;
- `npm run eval:safety`.

CI must not require secrets, provider keys, external runtimes, or platform
adapter credentials. A failing test or eval fails the gate.
