# Approval Decision Contract

Approval decisions record human review of an approval-required action record.
They do not execute anything by themselves.

Required fields:

- `decision_id`;
- `record_id`;
- `actor_ref`;
- `decision`: `approved` or `denied`;
- `decided_at`;
- `reason`;
- `scope`;
- `expires_at`.

The decision scope must match the action record's `approval_request` target and
action.

## Current Behavior

- Denied decisions keep the action blocked.
- Approved decisions still keep contract-only routes blocked because execute-now
  and external dispatch remain disabled.
- Approved decisions may execute a built-in allowlisted local control action
  when the action record route declares that boundary.
- Expired decisions are rejected.
- Voice invocation is not approval.
- Adapter request files cannot carry approval decisions.
