# Siri Shortcuts Local Runbook

Status: V1 local fixture path documented and covered by tests.

This runbook defines the V1 local voice surface:

```text
Siri or Shortcuts captures text -> command-deck runs on the Mac -> Shortcuts
speaks adapter_response.spoken_text
```

This is local-runner dogfood. It does not call SourceGrid, AppRelay,
OperatorKit, ManyMind, or any hosted runtime.

## One-Shortcut Rule

Do not create one Shortcut per CommandDeck command.

Shortcuts is only a thin adapter. The command registry belongs in CommandDeck
and the active command pack. The one Shortcut should forward a command request
to the Mac runner, then speak the returned response.

Allowed in Shortcuts:

- capture or receive text;
- call the local CommandDeck runner;
- parse returned JSON;
- speak `adapter_response.spoken_text`;
- display `adapter_response.display_text`.

Not allowed in Shortcuts:

- encode every command as a separate Shortcut;
- make permission decisions;
- treat voice invocation as approval;
- store provider keys, AppRelay credentials, SourceGrid secrets, or payment
  data;
- choose AppRelay providers or model names.

## Requirements

- MacBook runner with this repository checked out.
- Node.js 20 or newer.
- The local smoke gate passes:

```sh
npm run smoke:local
```

- Siri/Shortcuts is available on the Apple device used as the capture surface.

## Preflight In Terminal

Run these on the Mac before creating the Shortcut:

```sh
cd /Users/jimmy1768/Projects/CommandDeck
npm run smoke:local
npm run command:local -- --request-file evals/fixtures/adapter_requests/apple_shortcuts.repo_status.local.json
command -v node
```

Expected CommandDeck properties:

- `record.adapter` is `apple_shortcuts`.
- `record.command_id` is `core.repo_status`.
- `adapter_response.response_mode` is `platform_tts`.
- `adapter_response.apple_intelligence_required` is `false`.
- `record_write.status` is `not_written`.

Save the absolute Node path returned by `command -v node`. Shortcuts may not
load the same shell profile as Terminal, so the shell script should use the
absolute Node path instead of assuming `node` is on `PATH`.

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

The first physical Shortcut should use this fixture:

```sh
evals/fixtures/adapter_requests/apple_shortcuts.repo_status.local.json
```

That fixture contains an adapter request equivalent to:

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

This is the fixture walkthrough. It proves the physical voice/speaking path
before dynamic command capture is added.

### 1. Create The Shortcut

Open the macOS Shortcuts app and create a new Shortcut:

- Name: `CommandDeck Local`
- Icon/color: any
- Purpose: run one fixed CommandDeck fixture and speak its response

### 2. Add Run Shell Script

Add action: `Run Shell Script`.

Use:

- Shell: `zsh`
- Input: none
- Pass input: not needed

Script:

```sh
cd /Users/jimmy1768/Projects/CommandDeck
/opt/homebrew/bin/node bin/command-deck.mjs --request-file evals/fixtures/adapter_requests/apple_shortcuts.repo_status.local.json
```

If `command -v node` returned a different path, replace
`/opt/homebrew/bin/node` with that path.

### 3. Parse JSON

Add action: `Get Dictionary from Input`.

Set its input to the shell script result.

### 4. Extract Spoken Text

Add action: `Get Dictionary Value`.

Use key:

```text
adapter_response.spoken_text
```

If the Shortcuts UI does not accept dotted paths, extract in two steps:

1. Get `adapter_response`.
2. From that dictionary, get `spoken_text`.

### 5. Speak Text

Add action: `Speak Text`.

Set its input to the value from step 4.

### 6. Optional Display

Optionally add `Show Result` or `Quick Look` using:

```text
adapter_response.display_text
```

### 7. Run Manually

Run the Shortcut from the Shortcuts app first.

Expected spoken output should be similar to:

```text
Repo status: main...origin/main; no local file changes.
```

If the repo has local changes, the count will differ. That is expected.

### 8. Run Through Siri

After the manual run works, invoke the Shortcut by name:

```text
Hey Siri, CommandDeck Local
```

This still runs the fixed fixture. It proves Siri can trigger the Shortcut and
the Mac can speak the CommandDeck response.

## Dynamic Command Capture

After the fixture path works physically, keep the same one Shortcut and replace
the shell script with a dynamic text command.

The Shortcut should ask for text, then pass that text directly to:

```sh
/opt/homebrew/bin/node bin/command-deck.mjs shortcut:run "$COMMAND_TEXT"
```

`shortcut:run` builds the Apple Shortcuts adapter request inside CommandDeck.
Shortcuts does not need to build JSON or write request files.

### Dynamic Shortcut Steps

1. Add action: `Ask for Input`.
2. Prompt: `CommandDeck command`.
3. Input type: text.
4. Keep the existing `Run Shell Script` action.
5. Set the shell script input to the text from `Ask for Input`.
6. Use this shell script:

```sh
cd /Users/jimmy1768/Projects/CommandDeck
/opt/homebrew/bin/node bin/command-deck.mjs shortcut:run "$1"
```

7. Set `Pass Input` to `as arguments`.
8. Keep the existing JSON parsing and Speak Text steps:
   `Get Dictionary from Input` -> `adapter_response` -> `spoken_text` ->
   `Speak Text`.

Now the voice flow is:

```text
Hey Siri, CommandDeck Local
Shortcut asks: CommandDeck command
User says: computer what is the status of this repo activate
Shortcut speaks: Repo status: ...
```

### Dynamic Terminal Test

Test the dynamic command from Terminal before changing the Shortcut:

```sh
/opt/homebrew/bin/node bin/command-deck.mjs shortcut:run "Computer what is the status of this repo activate"
```

Expected properties are the same as the fixture path, but `record.command_text`
will be the text supplied to `shortcut:run`.

## Safety Rules

- Voice invocation is not approval.
- The end code `activate` is not approval.
- Approval-required commands should return `requested_pending` and must not
  execute from the initial voice command.
- Shortcuts must not store provider keys, SourceGrid secrets, AppRelay secrets,
  payment data, authorization headers, or environment values.
- If CommandDeck returns a concept-checking question, speak the question and
  wait for the user to answer through the normal CCQ resume path.

## Troubleshooting

### Shortcut says Node was not found

Use the absolute Node path from:

```sh
command -v node
```

Then update the `Run Shell Script` action.

### Shortcut says the repo path was not found

Confirm this path exists on the Mac running the Shortcut:

```sh
/Users/jimmy1768/Projects/CommandDeck
```

The shell script must run on the same Mac where the CommandDeck repo and runner
exist.

### Shortcut speaks raw JSON

The JSON parsing step is missing or wired to the wrong input. The shell script
returns the full command result. The Shortcut should speak only:

```text
adapter_response.spoken_text
```

### Shortcut says CommandDeck could not classify the command

For the fixture path, this means the fixture or core pack changed. Run:

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/apple_shortcuts.repo_status.local.json
```

For the future dynamic path, this usually means the spoken command does not
match the active pack and CommandDeck should ask a concept-checking question or
fail closed.

### Approval-required command does not execute

That is expected. Voice invocation is not approval. The initial response should
request approval and not run the GUI action.

### The spoken repo status says there are local changes

That is normal when the repo has uncommitted edits. The fixture calls the real
allowlisted `git status` local runner action.

## Verification Commands

Run these after editing this runbook or the fixture:

```sh
npm run command:local -- --request-file evals/fixtures/adapter_requests/apple_shortcuts.repo_status.local.json
/opt/homebrew/bin/node bin/command-deck.mjs shortcut:run "Computer what is the status of this repo activate"
npm run smoke:local
npm run verify
```

## Gap After Dynamic Siri

The fixture and dynamic `shortcut:run` paths are enough to test the Mac runner
and physical speaking loop. The next gap is latency. Do not optimize latency
until dynamic capture works physically through Siri/Shortcuts.
