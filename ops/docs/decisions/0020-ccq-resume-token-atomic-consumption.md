# 0020. CCQ Resume Tokens Use Atomic Consumption

Date: 2026-06-12

## Status

Accepted.

## Context

CCQ resume tokens are one-use. Separate Siri/Shortcuts or CLI invocations may
arrive close together, and voice platforms can retry requests.

Without a concurrency rule, two follow-ups could both read the same local action
record while the token is still `active` and both attempt to route different
answers.

## Decision

V1 resume token consumption uses an atomic compare-and-set rule.

Only this transition may consume a token:

```text
active -> used
active -> expired
active -> rejected
```

If the current token status is already `used`, `expired`, or `rejected`, the
resume attempt must not route.

The local file implementation uses a short lock file around `ccq:resume
--write-record`. The contract source of truth remains the token state
transition, not the lock.

Fresh lock files fail safely without routing. Lock files older than 30 seconds
are considered stale and may be removed before retrying the lock acquisition.
Stale-lock cleanup may remove only the `.lock` file, never the action record.

Duplicate or late attempts should return:

```text
That clarification is no longer active. Please give the command again.
```

## Consequences

- One-use token semantics are enforceable and testable.
- Duplicate adapter retries cannot route twice.
- The rule maps cleanly to a later database implementation using conditional
  updates.
- Local implementation still needs safe file update behavior to preserve the
  compare-and-set invariant.
