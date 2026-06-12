# 0011: PC Command Runner Flow

Status: Accepted for Phase 1 prototype.

## Context

CommandDeck's purpose was unclear if framed as "voice access to coding." Codex
already supports voice input and is the correct interface for code editing,
repo reasoning, patch generation, test loops, and implementation work.

The more useful product role is outside Codex: a hands-off command layer for
the user's local workspace. The PC is the command runner because it owns local
services, app state, devices, credentials, browser sessions, scripts, and
development context. For SourceGrid, the first runner is the user's Apple PC.

## Decision

CommandDeck assists the user's command flow. It connects voice and shortcut
invocations to permissioned local workspace commands.

The first working mode is a phone Siri surface and the local PC as the command
runner:

```text
Hey Siri, computer <action> <object> [context] [end code]
  -> Apple Shortcut
  -> PC CommandDeck runner
  -> sourcegrid-labs command pack and scripts
```

Phones, watches, glasses, and computers are capture surfaces. They must not
bypass the PC runner. If multiple surfaces are enabled, duplicate handling
should be done with a `request_id` and a short dedupe window.

Examples of intended future command domains:

- start or stop local dev services;
- inspect service health;
- open workspace apps and URLs;
- switch audio or connected devices;
- play approved media routines;
- prepare draft notes or handoffs;
- route bounded work to AppRelay, OperatorKit, or ManyMind by contract.

CommandDeck must not replace Codex. If editing code, the user works from the
PC in Codex or the normal development toolchain.

## Consequences

- Voice adapters are valuable because they control the workspace outside Codex.
- The PC-local runner is a first-class future execution target.
- The preferred V1 spoken device code is `computer`, which maps to the internal
  `target_runner: "command"` boundary.
- The Apple-PC local runner is the first SourceGrid execution target.
- Remote phone-to-cloud repo editing is not the default model.
- Command packs should describe exact, permissioned routines, not broad coding
  autonomy.
- SourceGrid-specific routines stay in `sourcegrid-labs`; another user can use
  their own assistant repo, such as `jimmys-assistant`, for their scripts.
- Google voice is a later expansion path for non-Apple PCs and other capture
  surfaces.

## Non-Goals

- No voice-driven code editing from a phone.
- No replacement for Codex.
- No autonomous local scripting without explicit command-pack permissions.
- No real execution in Phase 1.
