# 0002: Local Action Record Storage

Status: Accepted for Phase 1 prototype.

## Context

CommandKit needs an accountability path before it can execute real workflows.
The first local shell already returns action-record-shaped JSON, but record
persistence should be explicit and constrained while the repo remains a
prototype.

## Decision

Use one JSON file per action record under `records/actions/` when persistence is
explicitly requested. The local CLI is print-only by default. Writing requires
the `--write-record` flag.

Record directories must be repo-relative and stay inside the CommandKit repo.
Generated action record JSON files are gitignored by default.

## Consequences

- Normal local commands do not write files.
- Tests can prove persistence remains opt-in.
- The repo gains an accountability storage convention without adding execution.
- Future production record storage still needs a separate decision.

## Non-Goals

- No execution records.
- No OperatorKit record writes.
- No remote database.
- No automatic commits of generated records.
- No customer, payment, infrastructure, or secret mutation.
