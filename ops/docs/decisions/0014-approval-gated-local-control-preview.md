# 0014: Approval-Gated Local Control Preview

Status: Accepted

## Context

CommandDeck now has a safe exact-local read-only preview path. The next useful
step is local control of the user's actual desktop, such as opening dashboards
or repos. Those actions mutate local desktop state, so they should not execute
directly from a voice or shortcut invocation.

## Decision

Add a second built-in local runner route for approval-gated local control:

- route: `local.exact_control`
- execution boundary: `allowlisted_local_runner`
- permission level: `approval-required`

Command invocation creates an action record with:

- `approval_status: requested_pending`
- a populated `approval_request`
- a `runner_action` stored as `action_key`

Execution happens only when a separate approval decision is applied and the
route/action pair is allowlisted by CommandDeck core.

Initial preview actions are:

- `workspace.open_sourcegrid_dashboard`
- `workspace.open_commanddeck_repo`

## Consequences

- Voice invocation remains separate from approval.
- Command packs still cannot embed shell or executable fields.
- Approval-required contract-only routes remain blocked.
- Starting services, switching devices, and other workspace-specific mutable
  actions still need owner-repo-specific conventions or a broader runner
  contract.
