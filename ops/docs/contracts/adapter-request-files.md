# Adapter Request File Contract

Adapter request files let local tests and CLI runs use the same structured shape
expected from Siri/Shortcuts.

Example:

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

Run:

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/apple_shortcuts.next_task.json
```

## Rules

- Request file path must be repo-relative.
- Adapter must be `apple_shortcuts` or `local_cli`.
- `actor_ref`, `command_text`, and `requested_output` are required.
- Voice invocation is not approval.
- Request files must not contain tokens, authorization headers, env values,
  provider keys, passwords, or secrets.
