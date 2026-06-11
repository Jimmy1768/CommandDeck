# Workspace Command Flow Contract

CommandKit is a command-flow layer for a user's workspace. The PC is the
command runner for local apps, devices, services, scripts, and development
state. For SourceGrid, the first command runner is the user's Apple PC.

Phones, watches, glasses, and computers can be capture surfaces. They capture the
command and return status, but they do not execute scripts or bypass the PC
runner.

## Intended Command Domains

Future command packs may define permissioned routines for:

- opening apps, URLs, dashboards, and workspaces;
- starting, stopping, or checking local services;
- switching audio or connected devices;
- playing approved media routines;
- preparing local draft artifacts;
- asking neighboring systems for bounded help through declared routes.

## First Mode

The first working mode is:

```text
Phone Siri
  -> Apple Shortcut
  -> PC CommandKit runner
  -> sourcegrid-labs command pack and scripts
  -> local apps/services/devices
  -> adapter_response.spoken_text back to the capture surface
```

The first voice grammar is:

```text
Hey Siri, <device code> <command>
```

Example:

```text
Hey Siri, command play focus music
```

`Hey Siri` is the Apple wake phrase. `<device code>` routes to a target runner.
The first reserved device code is `command`. `<command>` is matched against a
permissioned command pack.

## Later Modes

After the Apple-PC mode works, the same contract can support:

- computer Siri directly invoking the local runner;
- phone Siri as a remote when the user is away from the PC microphone;
- Google voice surfaces for non-Apple PCs;
- watches, glasses, Expo, or mobile remotes for buttons, status, approvals, and
  notifications.

## Code Editing Rule

If editing code, work from the PC in Codex or the normal local development
toolchain. CommandKit may prepare or inspect the workspace, but it does not
edit code by voice and does not replace Codex.

## Phase 1 Boundary

This repository defines only contracts, fixtures, and deterministic validation.
Workspace commands that open apps, switch devices, run services, or mutate
local state require a later execution boundary, permission tests, approval
rules, and action records.
