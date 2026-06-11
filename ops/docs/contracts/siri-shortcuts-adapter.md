# Siri/Shortcuts Adapter Contract

The Siri/Shortcuts adapter is a thin invocation and response surface. It gathers
an explicit spoken or typed request, sends structured input to CommandDeck, and
can speak or display the returned response.

Siri and Shortcuts are not CommandDeck's reasoning layer. CommandDeck handles
permissions, routing, and records. AppRelay provides LLM/runtime capability when
model reasoning is needed in a later phase.

## Request Shape

```json
{
  "adapter": "apple_shortcuts",
  "adapter_version": "0.1",
  "actor_ref": "director",
  "request_id": "req_example_001",
  "surface_hint": "phone",
  "device_code": "command",
  "target_runner": "command",
  "command_text": "What is my next SourceGrid task?",
  "device_context": {
    "platform": "ios",
    "locale": "en-US",
    "timezone": "Asia/Taipei"
  },
  "requested_output": "spoken_summary"
}
```

## Adapter Responsibilities

- Capture an explicit invocation.
- Map the spoken device code to `device_code` and `target_runner`.
- Pass actor evidence and command text to CommandDeck.
- Display or speak the returned response.
- Preserve the returned action record id when available.

## Adapter Non-Responsibilities

- Do not decide permissions.
- Do not execute risky actions.
- Do not store provider keys.
- Do not choose LLM providers.
- Do not rely on Apple Intelligence for CommandDeck reasoning.
- Do not bypass server-side or local shell permission checks.
- Do not treat voice invocation as approval.

## Response Shape

```json
{
  "response_text": "Next task: Review CommandDeck repo skeleton.",
  "adapter_response": {
    "display_text": "Next task: Review CommandDeck repo skeleton.",
    "spoken_text": "Next task: Review CommandDeck repo skeleton.",
    "record_ref": "rec_example",
    "response_mode": "platform_tts",
    "apprelay_audio_available": false
  }
}
```
