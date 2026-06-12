# 0018. CCQ Resume Tokens Are Short-Lived Bound Conversational State

Date: 2026-06-12

## Status

Accepted.

## Context

A CCQ follow-up answer is often incomplete by itself.

Example:

```text
CommandDeck: Which dashboard?
User: production
```

The word `production` is only safe if CommandDeck can bind it to the unresolved
command that asked the question.

## Decision

V1 `resume_token` values are short-lived conversational state, not durable
memory or a task queue.

A resume token is valid only when it is:

- from the same `actor_ref`;
- in the same workspace;
- in the same adapter session when the adapter provides session identity;
- within a short TTL, initially 300 seconds;
- unused.

Resume tokens are one use only. After a follow-up is accepted or rejected, the
token must not remain valid for another fill attempt.

If the token is missing, expired, already used, or not bound to the same actor
and workspace, CommandDeck must treat the utterance as a new command or ask a
fresh CCQ. It must not attach the answer to the old command.

## Consequences

- A random later utterance cannot accidentally fill an old CCQ.
- Another actor cannot complete Jimmy's unresolved command.
- A different workspace cannot reuse a vague answer like `production`.
- Adapters should preserve session identity during a clarification turn when
  available, but adapters still do not own reasoning, approval, or execution.
- Longer-lived reminders, task queues, or saved preferences require separate
  contracts.
