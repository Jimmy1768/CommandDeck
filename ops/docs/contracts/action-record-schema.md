# Action Record Schema

Every material command should create or update an action record. In slice 1,
records are fixtures only.

## Required Fields

- `record_id`;
- `command_id`;
- `timestamp`;
- `actor_ref`;
- `adapter`;
- `command_text`;
- `interpreted_intent`;
- `permission_level`;
- `approval_status`;
- `route`;
- `sources_used`;
- `model_provider_route`;
- `action_key`;
- `result`;
- `errors`;
- `follow_up_owner`.

## Approval Status Values

- `not_required`;
- `required_not_requested`;
- `requested_pending`;
- `approved`;
- `denied`;
- `blocked_execute_now_disabled`.

## Record Rule

Approval-required commands in slice 1 must produce a record whose result is
blocked, not executed.
