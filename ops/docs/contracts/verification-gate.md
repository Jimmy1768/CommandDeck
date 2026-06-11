# Verification Gate Contract

The Phase 1 verification gate is:

```sh
npm run verify
```

It must run:

- `npm test`;
- `npm run validate:fixtures`;
- `npm run eval:mvp`;
- `npm run eval:safety`;
- `npm run eval:approval`.

CI must not require secrets, provider keys, external runtimes, or platform
adapter credentials. A failing test or eval fails the gate.

The gate also protects the adapter response contract: voice/display response
fields, record references, disabled AppRelay audio, and disabled Siri/Google
reasoning must remain covered by tests or evals.
