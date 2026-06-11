# 0010: Voice Adapters Are I/O Surfaces

Status: Accepted for Phase 1 prototype.

## Context

CommandDeck's first voice-facing path is Siri/Shortcuts, with future room for
Google voice and other platform adapters. The product boundary needs to be
explicit that platform voice tools are not the CommandDeck reasoning layer.

## Decision

Treat Siri, Shortcuts, Google voice, and future voice adapters as input/output
surfaces only.

They may capture user speech, send structured requests, speak response text, or
play response audio in a later phase. They do not own command reasoning,
permissions, routing, model/provider selection, or action records.

AppRelay owns LLM/runtime capability when CommandDeck needs model reasoning or
future generated audio. CommandDeck must not depend on Apple Intelligence for
reasoning.

## Consequences

- Siri/Shortcuts can be the first voice adapter without making Siri the brain.
- Google voice can be added later with the same adapter contract.
- The first speak-back mode can use platform TTS over returned text.
- A later speak-back mode can use AppRelay-generated audio.
- Voice invocation remains separate from approval.
