# Workspace Command Flow Contract

CommandDeck is a command-flow layer for a user's workspace. The PC is the
command runner for local apps, devices, services, scripts, and development
state. For SourceGrid, the first command runner is the user's Apple PC.

Phones, watches, glasses, and computers can be capture surfaces. They capture the
command and return status, but they do not execute scripts or bypass the PC
runner.

## Capability Sources

Workspace routines can come from two places:

- `core`: generic built-in actions such as opening, playing, pausing, checking
  status, or other reusable computer-control primitives;
- `pack`: workspace-specific automation such as SourceGrid routines or a user's
  personal operating scripts.

Pack capability is still executed through CommandDeck core. The difference is
where the routine definition and customization live, not whether the engine is
involved.

## Intended Command Domains

Future command packs may define permissioned routines for:

- opening apps, URLs, dashboards, and workspaces;
- starting, stopping, or checking local services;
- switching audio or connected devices;
- playing approved media routines;
- preparing local draft artifacts;
- asking neighboring systems for bounded help through declared routes.

Exact local routines should not require AppRelay or SourceGrid credits. They
should run through deterministic command-pack matches and local permission
checks. AppRelay is reserved for reasoning, summarization, ambiguity resolution,
or generated response modes.

This means "simple" versus "capable" is a separate split from `core` versus
`pack`:

- simple/exact commands can come from core or pack;
- capable/AppRelay-mediated commands can also come from core or pack.

## First Mode

The first working mode is:

```text
Phone Siri
  -> Apple Shortcut
  -> PC CommandDeck runner
  -> sourcegrid-labs command pack and scripts
  -> local apps/services/devices
  -> adapter_response.spoken_text back to the capture surface
```

The first voice grammar is:

```text
Hey Siri, <device code> <action> <object> [context] [end code]
```

Example:

```text
Hey Siri, computer play focus music activate
```

`Hey Siri` is the Apple wake phrase. `<device code>` is the spoken routing word.
The preferred V1 device code is `computer`, which maps to
`target_runner: "command"` and routes to the local PC runner. `<action>` and
`<object>` are required when the requested action needs them. `[context]`
contains details such as repo, dashboard, service, environment, or output mode.
`[end code]` may use `activate` as a phrase terminator, but it is not approval.

If the command omits a parameter required for the action to complete,
CommandDeck should return a concept-checking question instead of guessing.

## Later Modes

After the Apple-PC mode works, the same contract can support:

- computer Siri directly invoking the local runner;
- phone Siri as a remote when the user is away from the PC microphone;
- Google voice surfaces for non-Apple PCs;
- watches, glasses, Expo, or mobile remotes for buttons, status, approvals, and
  notifications.

## Code Editing Rule

If editing code, work from the PC in Codex or the normal local development
toolchain. CommandDeck may prepare or inspect the workspace, but it does not
edit code by voice and does not replace Codex.

## Current Boundary

The default runtime path uses the built-in core pack for CommandDeck-owned core
actions on Apple PCs:

- exact local read-only actions such as repo status, recent commits, Puma
  status, and Sidekiq status;
- approval-gated local control actions such as opening a dashboard or repo.

The MVP pack remains a legacy fixture/eval pack for contract regression tests,
not the default runtime pack.

These built-in actions prove the engine and the Apple-first invocation surface.
They are not the full pack execution story.

Workspace commands that open apps, switch devices, start services, or mutate
local state in owner-specific ways still require a later owner-pack runner
contract, permission tests, and approval rules.
