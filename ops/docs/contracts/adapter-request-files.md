# Adapter Request File Contract

Adapter request files let local tests and CLI runs use the same structured shape
expected from Siri/Shortcuts and future Google voice surfaces.

Example:

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

Run:

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/apple_shortcuts.next_task.json
```

Google voice contract fixture:

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/google_voice.next_task.json
```

## Rules

- Request file path must be repo-relative.
- Adapter must be `apple_shortcuts`, `google_voice`, or `local_cli`.
- `actor_ref`, `command_text`, and `requested_output` are required.
- `request_id` should be included by real adapters so the runner can reject
  duplicate submissions.
- `surface_hint` identifies the user-facing capture surface: `phone`, `watch`,
  `glasses`, or `computer`.
- `local_cli` is an adapter for terminal-based developer and test runs, not a
  capture surface. CLI requests may omit `surface_hint`.
- `device_code` carries the spoken routing word when one exists.
- `target_runner` identifies the intended PC runner. The initial reserved value
  is `command`.
- Voice invocation is not approval.
- Request files must not contain tokens, authorization headers, env values,
  provider keys, passwords, or secrets.
- Google voice remains an input/output surface; it does not provide CommandKit
  reasoning.

The first Siri phrase format is:

```text
Hey Siri, <device code> <command>
```

The Shortcut or adapter maps `<device code>` to `device_code` and
`target_runner` before sending the request. The first device code is `command`.
