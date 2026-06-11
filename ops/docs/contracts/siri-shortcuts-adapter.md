# Siri/Shortcuts Adapter Contract

The Siri/Shortcuts adapter is a thin invocation surface. It gathers an explicit
spoken or typed request and sends structured input to CommandKit.

## Request Shape

```json
{
  "adapter": "apple_shortcuts",
  "adapter_version": "0.1",
  "actor_ref": "director",
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
- Pass actor evidence and command text to CommandKit.
- Display or speak the returned response.
- Preserve the returned action record id when available.

## Adapter Non-Responsibilities

- Do not decide permissions.
- Do not execute risky actions.
- Do not store provider keys.
- Do not bypass server-side or local shell permission checks.
- Do not treat voice invocation as approval.

## Response Shape

```json
{
  "command_id": "cmd_0001",
  "response_text": "Your next task is to review the pending dry-run plan.",
  "record_ref": "action_records/cmd_0001.json",
  "approval_required": false
}
```
