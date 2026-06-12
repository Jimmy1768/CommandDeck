# 0016: Spoken Command Slot Convention

Status: Accepted for Phase 1 prototype.

## Context

The older prototype grammar treated the full post-Siri phrase as a generic
command. That was enough for fixtures, but it did not clearly separate routing,
action, target, context, and phrase termination.

CommandDeck needs a convention that works across phone, watch, glasses, and
computer capture surfaces while keeping the local PC runner as the execution
surface.

## Decision

The V1 spoken convention is:

```text
<platform wake phrase>, <device code> <action> <object> [context] [end code]
```

For Siri:

```text
Hey Siri, computer open ops dashboard activate
```

Slot meanings:

- `platform wake phrase`: owned by the platform, such as `Hey Siri` or `Siri`.
- `device code`: spoken routing word; V1 prefers `computer` for the local PC
  runner.
- `action`: requested operation, such as open, close, find, start, stop, play,
  or pause.
- `object`: target of the action, such as app, service, dashboard, repo,
  device, workflow, or data view.
- `context`: required qualifiers such as repo, environment, what, where, or how.
- `end code`: optional phrase terminator; V1 allows `activate`.

The adapter request still separates:

- `surface_hint`: where the command was captured, such as phone, watch,
  glasses, or computer;
- `device_code`: the spoken routing word, such as `computer`;
- `target_runner`: the internal runner boundary, initially `command`;
- `command_text`: the action, object, context, and optional end code phrase.

## Consequences

- Bare target aliases do not imply hidden actions.
- Users provide as many parameters as the action requires.
- If required parameters are missing, CommandDeck returns a concept-checking
  question.
- Per-action required parameters are defined by the action requirements
  contract.
- `activate` can help delimit speech, but it is not approval.
- Voice invocation remains separate from approval decisions.
