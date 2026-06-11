# Voice Adapter Boundary

Voice platforms are input/output surfaces for CommandKit. They are not the
reasoning layer.

The intended path is:

```text
Siri / Shortcuts / Google voice / future voice adapter
  -> capture explicit user command
  -> send structured request to CommandKit
  -> CommandKit checks permissions, routes, and records
  -> AppRelay provides LLM/runtime capability when needed
  -> CommandKit returns text or audio response
  -> adapter speaks, displays, or plays the response
```

## Responsibilities

Voice adapters may:

- capture explicit speech or typed invocation;
- provide platform context such as locale and timezone;
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

## Speech Output Modes

Phase 1 and first voice phase:

```text
CommandKit response text -> platform TTS speaks it
```

Future phase:

```text
CommandKit/AppRelay response audio -> adapter plays it
```

## Apple Intelligence

CommandKit must not depend on Apple Intelligence for command reasoning. Siri and
Shortcuts can be used for capture, transport, and spoken output without making
Apple Intelligence part of the CommandKit reasoning path.

## Google Voice

Google voice surfaces should follow the same adapter boundary: capture command,
send structured request, speak or display response, and leave reasoning,
permissions, routing, and records to CommandKit and AppRelay.
