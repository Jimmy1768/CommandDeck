# Voice Adapter Boundary

Voice platforms are input/output surfaces for CommandDeck. They are not the
reasoning layer.

The intended path is:

```text
Siri / Shortcuts / Google voice / future voice adapter
  -> capture explicit user command
  -> send structured request to CommandDeck
  -> PC command runner checks permissions, routes, and records
  -> declared owner repo provides command pack and scripts
  -> AppRelay provides LLM/runtime capability when needed
  -> CommandDeck returns text or audio response
  -> adapter speaks, displays, or plays the response
```

Voice capture and platform TTS are not SourceGrid-credit-gated. Credits only
matter when a command routes to AppRelay or another SourceGrid-billed runtime
for reasoning, summarization, generated audio, or similar capability.

Phones, watches, glasses, and computers are capture surfaces. They must not
bypass the local PC runner that owns local apps, services, devices, and scripts.

## Responsibilities

Voice adapters may:

- capture explicit speech or typed invocation;
- provide platform context such as locale and timezone;
- provide a capture surface such as `phone`, `watch`, `glasses`, or `computer`;
- provide the target runner alias `command`;
- send structured requests to CommandDeck;
- speak returned response text with platform TTS;
- play returned audio in a future phase.

Voice adapters must not:

- decide permissions;
- treat voice invocation as approval;
- execute risky actions;
- choose LLM providers;
- store provider keys;
- become the reasoning layer.

## AppRelay Boundary

AppRelay owns LLM/runtime capability when CommandDeck needs model reasoning,
tool-routing support, or generated audio in a future phase. Siri, Shortcuts,
Google voice, and similar adapters should not be used as CommandDeck's brain.

## Invocation Grammar

The first Siri grammar is:

```text
Hey Siri, <device code> <action> <object> [context] [end code]
```

Examples:

```text
Hey Siri, computer play focus music activate
Hey Siri, computer start SourceGrid work mode
Hey Siri, computer open ops dashboard
```

`Hey Siri` is the platform wake phrase. CommandDeck controls only the phrase
after Siri wakes. The preferred V1 spoken device code is `computer`, which maps
to `target_runner: "command"`. The request should carry the parsed device code
as `device_code` and identify the capture surface with `surface_hint`.

`surface_hint` records where the command was captured, such as `phone`, `watch`,
`glasses`, or `computer`. It is not the same thing as the spoken routing word.

If the action needs more information than the phrase provides, CommandDeck
should return a concept-checking question. `activate` can terminate the phrase,
but voice invocation and end codes are not approval.

## Speech Output Modes

Phase 1 and first voice phase:

```text
CommandDeck adapter_response.spoken_text -> platform TTS speaks it
```

Future phase:

```text
CommandDeck/AppRelay audio reference -> adapter plays it
```

## Apple Intelligence

CommandDeck must not depend on Apple Intelligence for command reasoning. Siri and
Shortcuts can be used for capture, transport, and spoken output without making
Apple Intelligence part of the CommandDeck reasoning path.

## Google Voice

Google voice surfaces should follow the same adapter boundary later: capture
command, send structured request, speak or display response, and leave
reasoning, permissions, routing, and records to CommandDeck and AppRelay. Google
is the expansion path for non-Apple PCs after the first Apple-PC mode works.
