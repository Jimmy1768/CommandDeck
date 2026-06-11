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
- create or update local files;
- commit locally when the workflow allows it;
- update internal non-production state.

The approval prompt must include target, action, risk, and expected record.

Slice 1 status: approval-required commands cannot execute. They can only return
a blocked or draft response.

## Execute-Now

Disabled by default. It is not available in slice 1.

Never enable execute-now for payments, production deploys, production restarts,
migrations, customer-data mutations, public messages, external-party contact,
infrastructure mutation, secrets, or physical-world actions.
