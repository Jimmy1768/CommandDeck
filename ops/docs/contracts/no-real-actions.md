# No Real Actions Boundary

The default core pack may run built-in allowlisted local reads and may run
allowlisted local controls only after a separate approval decision. The repo
must not perform real external integrations or unapproved state-changing work.

Allowed:

- validate JSON fixtures;
- document route contracts;
- draft example responses;
- run built-in allowlisted local read-only commands;
- execute built-in allowlisted local control commands only after a separate
  approval decision;
- model action record shapes.

Forbidden:

- editing code by voice as a substitute for Codex;
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
