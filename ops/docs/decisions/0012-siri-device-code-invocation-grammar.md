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
Hey Siri, <device code> <action> <object> [context] [end code]
```

Examples:

```text
Hey Siri, computer play focus music activate
Hey Siri, computer start SourceGrid work mode
Hey Siri, computer open ops dashboard
```

The Apple wake phrase starts Siri. The preferred V1 spoken device code is
`computer`. The device code becomes `device_code`, the local runner alias
remains `target_runner: "command"`, and the remaining phrase becomes
`command_text`.

Real adapter requests should include:

- `request_id`: unique id for duplicate suppression;
- `surface_hint`: capture surface, such as `phone`, `watch`, `glasses`, or
  `computer`;
- `device_code`: spoken routing word, preferably `computer`;
- `target_runner`: intended runner, initially `command`;
- `command_text`: command to classify against the attached command pack.

If the action needs more fields than the phrase provides, CommandDeck should
return a concept-checking question instead of guessing. The optional end code
`activate` can terminate a phrase, but it is not approval.

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
