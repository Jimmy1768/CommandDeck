# 0021. CCQ Audit Retention And Cleanup

Date: 2026-06-12

## Status

Accepted.

## Context

CCQ records are temporary command state plus audit evidence. They are not
learned memory, preferences, reminders, or a task queue.

The resume token should expire quickly, but the action record can remain useful
after expiry for debugging voice flows and explaining why CommandDeck asked or
rejected a clarification.

## Decision

V1 separates token lifetime from audit retention:

- active resume token TTL: 300 seconds;
- audit retention for expired or terminal CCQ records: 7 days;
- cleanup mode: explicit manual local command only;
- automatic background cleanup: disabled in V1.

Cleanup applies only to expired or terminal CCQ records. Active CCQ records must
not be pruned.

Cleanup must not create, modify, promote, or delete learned memory. CCQ cleanup
is record hygiene only.

## Consequences

- Users can debug recent clarification behavior after a session.
- Temporary voice state does not accumulate indefinitely.
- V1 avoids accidental background deletion while schemas are still changing.
- A later automatic cleanup worker or scheduler needs a separate implementation
  decision and tests.
