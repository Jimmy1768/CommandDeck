# 0012: Siri Command Device-Code Invocation Grammar

Status: Accepted for Phase 1 prototype.

## Context

Apple owns the Siri wake phrase. CommandDeck cannot define arbitrary system wake
words such as "Hey iPhone" or "Hey MacBook" for Apple devices.

CommandDeck still needs a simple way to route commands between possible capture
surfaces and the locked-down local PC runner without creating duplicate or
ambiguous commands.

## Decision

The first Siri invocation grammar is:

```text
Hey Siri, <device code> <command>
```

Examples:

```text
Hey Siri, command play focus music
Hey Siri, command start SourceGrid work mode
Hey Siri, command open dashboard
```

The Apple wake phrase starts Siri. The first reserved device code is `command`.
The device code becomes `device_code`, the local runner alias becomes
`target_runner: "command"`, and the remaining phrase becomes `command_text`.

Real adapter requests should include:

- `request_id`: unique id for duplicate suppression;
- `surface_hint`: capture surface, such as `phone`, `watch`, `glasses`, or
  `computer`;
- `device_code`: spoken routing word, initially `command`;
- `target_runner`: intended runner, initially `command`;
- `command_text`: command to classify against the attached command pack.

## Consequences

- Phone Siri can act as a remote when the user is away from the PC microphone.
- Computer Siri can still be used locally when the user is near the PC.
- Multiple surfaces may remain enabled if the runner deduplicates `request_id`
  values and commands remain permissioned.
- CommandDeck remains platform-neutral after request ingestion.
- Google voice can reuse the same request fields later for non-Apple PCs.

## Non-Goals

- No custom Apple wake phrase.
- No direct phone execution.
- No bypassing the PC runner.
- No voice-driven code editing path.
