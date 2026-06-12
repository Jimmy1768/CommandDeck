# Permission Levels

CommandDeck separates authentication from authorization. A valid actor identity
does not imply permission to perform an action.

Every material command resolves:

```text
actor identity
  -> resource target
  -> requested action
  -> permission source
  -> approval requirement
  -> audit record
```

## Read-Only

Allowed:

- inspect local records and fixtures;
- summarize status;
- read approved source files;
- report recent commits from approved local sources;
- answer from retrieved context.

Forbidden: any state change.

## Draft-Only

Allowed:

- draft handoffs;
- draft acceptance records;
- draft ManyMind source-packet outlines;
- draft replies;
- draft commands for human review.

Forbidden: send, commit, push, deploy, restart, migrate, external message,
customer-data mutation, payment, or secret write.

## Approval-Required

Allowed only after explicit confirmation in later phases:

- write operator records;
- dispatch an OperatorKit task;
- run local scripts;
- open local apps, folders, or dashboards through an allowlisted runner action;
- create or update local files;
- commit locally when the workflow allows it;
- update internal non-production state.

The approval prompt must include target, action, risk, and expected record.

Current status: contract-only approval routes still cannot execute. Built-in
allowlisted local control routes may create an approval request first and then
execute only after a separate human decision is applied.

## Execute-Now

Disabled by default. It is not available in slice 1.

Never enable execute-now for payments, production deploys, production restarts,
migrations, customer-data mutations, public messages, external-party contact,
infrastructure mutation, secrets, or physical-world actions.
