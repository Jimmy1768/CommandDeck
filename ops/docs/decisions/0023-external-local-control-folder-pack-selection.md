# 0023: External Local Control Folder Pack Selection

Status: Accepted for V1.

## Context

CommandDeck needs one source of truth for pack ownership.

CommandDeck-owned core packs belong in this repository and are updated by
CommandDeck maintainers. Custom packs belong to the user, company, or partner
using them, so they should be version controlled in that owner repo or local
control folder.

Copying custom packs into CommandDeck would blur ownership and make CommandDeck
the source of truth for user-specific workspace automation.

## Decision

V1 supports selecting custom pack manifests from external local control folders
when all of the following are true:

- the folder is configured as a `local-folder` command-pack root;
- the root is marked `local_only: true`;
- the root is enabled;
- the selection manifest names the configured root;
- `pack_path` is relative to that root;
- the resolved file stays inside that root;
- the selected file ends with `.cdeck-pack.json`;
- the pack contract validates locally before it becomes active.

Direct `--command-pack` paths remain repo-relative. Arbitrary absolute pack
paths are not accepted.

## Consequences

- SourceGrid Labs can act like a constrained selector for pack manifests.
- Custom packs can live in user-owned or company-owned git repos.
- CommandDeck remains the contract and runner-boundary owner, not the owner of
  every user's scripts.
- The selected external pack is represented as
  `control-root:<root-id>/<pack_path>` in local state.

## Non-Goals

- No remote shell.
- No owner-repo crawling.
- No script import into CommandDeck core.
- No automatic execution from a selected pack.
- No multiple active company/person packs for one invocation.
