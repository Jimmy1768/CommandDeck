# No Real Actions Boundary

Slice 1 is contract-only. The repo must not perform real integrations or
state-changing work.

Allowed:

- validate JSON fixtures;
- document route contracts;
- draft example responses;
- model action record shapes.

Forbidden:

- calling AppRelay, OperatorKit, or ManyMind;
- running production deploys or restarts;
- mutating infrastructure;
- mutating customer data;
- sending external messages;
- processing payments;
- storing or writing secrets;
- enabling execute-now.

Any future change that adds execution must include permission tests, approval
tests, action records, and an explicit architecture decision.
