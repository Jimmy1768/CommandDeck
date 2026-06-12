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
- `approval_request`;
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

## Missing Optional Dependency

When a selected route requires an optional dependency that is not configured,
the action record must use:

- `result.status: blocked_missing_optional_dependency`;
- `setup_required: true`;
- `can_retry_after_setup: true`;
- `missing_dependency`;
- `route_family`;
- `setup_hint`;
- `authoring_fix_hint`.

The response must distinguish dependency setup from pack authoring mistakes:

- If the route is correct, the user can install/configure the dependency and
  retry.
- If the route is wrong, the pack author should change the route family.

CommandDeck must not fall back to shell execution or silently substitute another
route.

## Record Rule

Approval-required contract-only commands must produce a record whose result is
blocked, not executed.

Concept-checking question records must use:

- `result.status: needs_clarification`;
- `route: none`;
- `approval_status: required_not_requested`;
- `errors: []`;
- `follow_up_owner: user`.

The result should include a `clarification` object with:

- `question`;
- `missing_slots`;
- `partial_intent`;
- `resume_token`;
- `resume_token_status`;
- `resume_token_expires_at`;
- `resume_token_used_at`;
- `workspace_ref`;
- `adapter_session_ref`.

See [Concept-Checking Question Contract](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/concept-checking-question.md:1).

CCQ state is stored in the local action record. It is auditable local state, not
durable memory, a task queue, or approval. Resume processing reads this record,
validates actor/workspace/session binding, TTL, and one-use token status, fills
missing slots only, then revalidates before routing.

Resume token consumption must be atomic. Only `active -> used`,
`active -> expired`, or `active -> rejected` may succeed. If the token is already
terminal, CommandDeck must not route the follow-up.

When `ccq:resume --write-record` updates the original action record, it uses a
short local action-record lock. Fresh locks fail safely without routing. Locks
older than 30 seconds are stale and may be removed before retrying. Cleanup
applies only to the `.lock` file, never the action record.

Expired or terminal CCQ records may be retained for audit for 7 days. V1 cleanup
is manual and explicit only; no background cleanup should delete records
automatically. Cleanup applies only to expired or terminal CCQ records and must
not affect learned memory.

Approval-gated local control commands may produce:

- `approval_status: requested_pending` before the decision is applied;
- `approval_status: approved` after an approved decision executes the built-in
  allowlisted local action;
- `approval_status: denied` after a denied decision.

Approval-required records must include `approval_request` with:

- `target`;
- `action`;
- `risk`;
- `expected_record`.

For read-only, draft-only, and failed-closed records, `approval_request` should
be `null`.
