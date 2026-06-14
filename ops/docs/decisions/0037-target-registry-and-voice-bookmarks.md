# 0037: Target Registry And Voice Bookmarks

Status: Accepted

## Context

CommandDeck is voice-friendly command infrastructure, not a chatbot. Voice is
good at selecting named things and bad at transmitting exact strings such as
URLs, repo paths, service identifiers, app bundle names, or dashboard routes.

If every webpage requires a script or a long command phrase, CommandDeck fails
its main purpose: reducing dev-ops friction.

## Decision

CommandDeck will model reusable objects as named targets.

The core pack owns generic actions such as `open`, `check`, `start`, `stop`,
`play`, and `pause`. Custom packs may declare workspace-specific targets that
those core actions can operate on.

The V1 target registry supports:

- homepage targets;
- environment-specific targets such as `dev` and `prod`;
- voice-friendly target aliases;
- small working bookmark sets for active pages;
- structured values such as URLs, repo paths, service names, or dashboard refs.

V1 runtime target alias resolution is enabled for core target-aware actions.
The first implemented path is approval-gated URL/dashboard opening through the
allowlisted local runner.

Targets do not execute by themselves. They fill the object slot of a command.
The action still comes from command grammar, and the route still passes through
CommandDeck permission, CCQ, approval, and runner policy.

## Examples

```json
{
  "target_id": "sourcecombatives.homepage.prod",
  "kind": "url",
  "display_name": "Source Combatives homepage",
  "aliases": ["source combatives", "source combatives homepage"],
  "environment": "prod",
  "value": "https://sourcecombatives.com"
}
```

The user may say:

```text
open source combatives homepage
```

CommandDeck resolves:

```text
action = core.open
target = sourcecombatives.homepage.prod
runner = core open-url behavior
```

For short-lived pages, packs may declare bookmarks:

```json
{
  "target_id": "sourcegrid.bookmark.webpage_1",
  "kind": "url",
  "display_name": "Webpage 1",
  "aliases": ["webpage one", "first page"],
  "bookmark": true,
  "value": "https://example.com/specific/page"
}
```

Codex or another setup assistant may help copy exact URLs into the pack or
local target registry. CommandDeck consumes the resulting structured data.

## Consequences

- Users do not need to speak long URLs.
- Pack authors do not need one script per webpage.
- Custom packs can piggyback on core actions without duplicating runner code.
- Dev/prod ambiguity uses a narrow defaulting rule: shared aliases are valid
  only for one logical dev/prod target family when `default_environment` is
  declared, and runtime defaulting is limited to safe target-aware core actions
  such as approval-gated URL/dashboard opens.
- Valid packs with distinct dev/prod aliases and no default environment may ask
  a runtime CCQ for one logical target family with two to four safe choices.
- Target aliases remain bounded data, not hidden execution behavior.
