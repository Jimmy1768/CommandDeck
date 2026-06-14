# Siri Shortcuts Local Runbook

This runbook defines the V1 local voice surface:

```text
Siri or Shortcuts captures text -> command-deck runs on the Mac -> Shortcuts
speaks adapter_response.spoken_text
```

This is local-runner dogfood. It does not call SourceGrid, AppRelay,
OperatorKit, ManyMind, or any hosted runtime.

## Requirements

- MacBook runner with this repository checked out.
- Node.js 20 or newer.
- The local smoke gate passes:

```sh
npm run smoke:local
```

- Siri/Shortcuts is available on the Apple device used as the capture surface.

## Spoken Shape

For operational commands, use:

```text
Hey Siri, computer <action> <object> [context] activate
```

Examples:

```text
Hey Siri, computer what is the status of this repo activate
Hey Siri, computer show recent commits activate
Hey Siri, computer is Puma running activate
Hey Siri, computer open source combatives activate
```

`Hey Siri` is owned by Apple. `computer` is the CommandDeck device code and
maps to `target_runner: "command"`. `activate` is only an end code. It is not
approval.

Calibration/help commands can use relaxed grammar:

```text
Hey Siri, command what commands can you understand
Hey Siri, command what is the command structure
Hey Siri, command Siri setup
```

## Shortcut Contract

The Shortcut should build an adapter request equivalent to:

```json
{
  "adapter": "apple_shortcuts",
  "adapter_version": "0.1",
  "actor_ref": "creator_local",
  "surface_hint": "phone",
  "device_code": "computer",
  "target_runner": "command",
  "command_text": "Computer what is the status of this repo activate",
  "device_context": {
    "platform": "ios",
    "locale": "en-US",
    "timezone": "Asia/Taipei",
    "shortcut_name": "CommandDeck Local"
  },
  "requested_output": "spoken_summary"
}
```

The fixture version lives at:

```sh
evals/fixtures/adapter_requests/apple_shortcuts.repo_status.local.json
```

Test it locally:

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/apple_shortcuts.repo_status.local.json
```

The output is JSON. The Shortcut should speak:

```text
adapter_response.spoken_text
```

It may also display:

```text
adapter_response.display_text
```

## Suggested Shortcut Steps

Create a Shortcut named `CommandDeck Local`:

1. Ask for text with the prompt `CommandDeck command`.
2. Create a Dictionary with the adapter request fields:
   `adapter`, `adapter_version`, `actor_ref`, `request_id`, `surface_hint`,
   `device_code`, `target_runner`, `command_text`, `device_context`, and
   `requested_output`.
3. Set `command_text` to the captured text.
4. Run a shell script on the Mac:

```sh
cd /Users/jimmy1768/Projects/CommandDeck
node bin/command-deck.mjs --request-file evals/fixtures/adapter_requests/apple_shortcuts.repo_status.local.json
```

For the first physical test, use the fixture command above instead of dynamic
JSON injection. That proves the Mac runner, CLI, JSON output, and speaking path
before adding Shortcut-side request-file generation.

After the fixture path works, the dynamic Shortcut can write the Dictionary JSON
to a temporary repo-relative request file, run:

```sh
node bin/command-deck.mjs --request-file records/actions/shortcut-request.json
```

and then delete or overwrite that temporary file on the next run.

5. Parse the shell output as JSON.
6. Speak `adapter_response.spoken_text`.
7. Optionally show `adapter_response.display_text`.

## Safety Rules

- Voice invocation is not approval.
- The end code `activate` is not approval.
- Approval-required commands should return `requested_pending` and must not
  execute from the initial voice command.
- Shortcuts must not store provider keys, SourceGrid secrets, AppRelay secrets,
  payment data, authorization headers, or environment values.
- If CommandDeck returns a concept-checking question, speak the question and
  wait for the user to answer through the normal CCQ resume path.

## First Manual Test

Run this before trying the physical Siri Shortcut:

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/apple_shortcuts.repo_status.local.json
```

Expected properties:

- `record.adapter` is `apple_shortcuts`.
- `record.command_id` is `core.repo_status`.
- `adapter_response.response_mode` is `platform_tts`.
- `adapter_response.apple_intelligence_required` is `false`.
- `record_write.status` is `not_written`.

Then wire the Shortcut to speak `adapter_response.spoken_text`.

## Gap Before Dynamic Siri

The fixture path is enough to test the Mac runner. The next gap is dynamic
request-file creation from Shortcuts. Do not add that until the fixture path
works physically on the Mac.
