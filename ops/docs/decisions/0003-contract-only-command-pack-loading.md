# 0003: Contract-Only Command-Pack Loading

Status: Accepted for Phase 1 prototype.

## Context

CommandKit needs to load command packs from configured JSON files before owner
repos can be attached later. For SourceGrid, the owner repo is
`sourcegrid-labs`. For another user, the owner repo might be a personal
assistant repo such as `jimmys-assistant`. Loading a pack must not imply
permission to execute scripts, call external services, or mutate state.

## Decision

The local shell may load a repo-relative JSON command pack with:

```sh
npm run command:local -- --command-pack contracts/commands/mvp-commands.json "What is my next SourceGrid task?"
```

Loaded packs are validated before classification. Phase 1 validation requires:

- command pack path is repo-relative;
- routes are known and `real_integration` is `false`;
- permissions are `read-only`, `draft-only`, or `approval-required`;
- `execute-now` is not accepted;
- command sources are repo-relative fixture files under `evals/fixtures/`;
- executable fields such as `script`, `shell`, `handler`, `env`, and `secrets`
  are forbidden;
- approval-required commands define an approval prompt.

## Consequences

- SourceGrid can add command-pack definitions and scripts later in
  `sourcegrid-labs` against a clear contract.
- Personal assistant and partner command packs follow the same owner-repo
  pattern.
- Command-pack loading remains contract-only and does not execute anything.

## Non-Goals

- No active command-pack loading from owner repos yet.
- No SourceGrid script imports.
- No personal assistant or partner script imports.
- No shell script execution.
- No external provider or runtime calls.
