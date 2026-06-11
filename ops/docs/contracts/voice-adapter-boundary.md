# Voice Adapter Boundary

Voice platforms are input/output surfaces for CommandKit. They are not the
reasoning layer.

The intended path is:

```text
Siri / Shortcuts / Google voice / future voice adapter
  -> capture explicit user command
  -> send structured request to CommandKit
  -> PC command runner checks permissions, routes, and records
  -> attached owner repo provides command pack and scripts
  -> AppRelay provides LLM/runtime capability when needed
  -> CommandKit returns text or audio response
  -> adapter speaks, displays, or plays the response
```

Phones, watches, glasses, and computers are capture surfaces. They must not
bypass the local PC runner that owns local apps, services, devices, and scripts.

## Responsibilities

Voice adapters may:

- capture explicit speech or typed invocation;
- provide platform context such as locale and timezone;
- provide a capture surface such as `phone`, `watch`, `glasses`, or `computer`;
- provide the target runner alias `command`;
- send structured requests to CommandKit;
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

AppRelay owns LLM/runtime capability when CommandKit needs model reasoning,
tool-routing support, or generated audio in a future phase. Siri, Shortcuts,
Google voice, and similar adapters should not be used as CommandKit's brain.

## Invocation Grammar

The first Siri grammar is:

```text
Hey Siri, <device code> <command>
```

Examples:

```text
Hey Siri, command play focus music
Hey Siri, command start SourceGrid work mode
Hey Siri, command open dashboard
```

`Hey Siri` is the platform wake phrase. CommandKit controls only the device code
and command phrase after Siri wakes. The request should carry the parsed device
code as `device_code`, use `target_runner: "command"`, and identify the capture
surface with `surface_hint`.

## Speech Output Modes

Phase 1 and first voice phase:

```text
CommandKit adapter_response.spoken_text -> platform TTS speaks it
```

Future phase:

```text
CommandKit/AppRelay audio reference -> adapter plays it
```

## Apple Intelligence

CommandKit must not depend on Apple Intelligence for command reasoning. Siri and
Shortcuts can be used for capture, transport, and spoken output without making
Apple Intelligence part of the CommandKit reasoning path.

## Google Voice

Google voice surfaces should follow the same adapter boundary later: capture
command, send structured request, speak or display response, and leave
reasoning, permissions, routing, and records to CommandKit and AppRelay. Google
is the expansion path for non-Apple PCs after the first Apple-PC mode works.
