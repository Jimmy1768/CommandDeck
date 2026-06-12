# 0019. CCQ State Is Backed By Local Action Records

Date: 2026-06-12

## Status

Accepted.

## Context

Siri/Shortcuts and local CLI flows may invoke CommandDeck as separate processes.
An in-memory CCQ token would disappear between invocations, making a follow-up
answer unreliable.

At the same time, deterministic local clarification should not require AppRelay
or network availability. A simple exact local command must remain usable even
when capable-lane services or SourceGrid-billed runtime paths are unavailable.

## Decision

V1 CCQ state is stored in the local action record.

The CCQ action record stores:

- the original command text
- the partial intent
- missing slots
- the clarification question
- the `resume_token`
- token expiry
- token status
- actor, workspace, adapter, and adapter-session binding where available

Resume processing reads the action record, validates token binding, TTL, and
one-use status, fills missing slots only, revalidates the merged intent, and then
routes, asks another CCQ, or fails closed.

The local action record is auditable state. It is not durable memory, a task
queue, or approval.

AppRelay may participate only when the command already requires capable-lane
reasoning. AppRelay is not required for deterministic local CCQ resume.

## Consequences

- CCQ resume works across separate Siri/Shortcuts or CLI invocations.
- Operators can inspect why CommandDeck asked a question or rejected a follow-up.
- Expired CCQ records need a pruning policy after an audit window.
- Local files need safe update behavior so a token cannot be reused by
  concurrent resume attempts.
- Future server-backed sessions can replace the storage implementation only if
  they preserve the same actor, workspace, TTL, one-use, and audit rules.
