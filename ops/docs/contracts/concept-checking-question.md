# Concept-Checking Question Contract

A concept-checking question, or CCQ, is a safe pause in routing.

It is not a failure, not approval, and not execution.

The machine-readable contract lives at:

- `contracts/records/concept-checking-question.schema.json`

Core action missing-slot questions are loaded from:

- `contracts/commands/core-action-requirements.json`

## Result State

CCQ records use:

- `result.status: needs_clarification`
- `route: none`
- `approval_status: required_not_requested`
- `errors: []`
- `follow_up_owner: user`

## Clarification Payload

The record result should include:

- `question`
- `missing_slots`
- `partial_intent`
- `resume_token`
- `resume_token_status`
- `resume_token_expires_at`
- `resume_token_used_at`
- `workspace_ref`
- `adapter_session_ref`

Example:

```json
{
  "status": "needs_clarification",
  "summary": "CommandDeck needs one more detail before routing.",
  "clarification": {
    "question": "What should I open?",
    "missing_slots": ["object"],
    "partial_intent": {
      "device_code": "computer",
      "action": "open",
      "object": null,
      "context": null,
      "end_code": "activate"
    },
    "resume_token": "ccq_example",
    "resume_token_status": "active",
    "resume_token_expires_at": "2026-06-12T09:05:00.000Z",
    "resume_token_used_at": null,
    "workspace_ref": "sourcegrid",
    "adapter_session_ref": "siri_session_example"
  }
}
```

## State Storage

V1 CCQ state is stored in the local action record under `records/actions/`.
This makes clarification auditable and lets Siri/Shortcuts or CLI follow-ups
resume across separate process invocations.

The stored state is not durable memory, a task queue, or approval. Expired CCQ
records may be pruned after the audit window.

AppRelay is not required for deterministic local CCQ resume. It may participate
only when the unresolved command already requires capable-lane reasoning.

## Cleanup Rule

Token lifetime and record retention are separate:

- active resume token TTL is 300 seconds
- expired or terminal CCQ records may be retained for audit for 7 days
- V1 cleanup is manual and explicit only
- automatic background cleanup is disabled in V1

Cleanup applies only to expired or terminal CCQ records. Active CCQ records must
not be pruned.

Cleanup is record hygiene only. It must not create, modify, promote, or delete
learned memory.

## Adapter Response

The adapter should speak and display the clarification question:

- `display_text: clarification.question`
- `spoken_text: clarification.question`
- `response_mode: platform_tts`
- `route: none`
- `approval_status: required_not_requested`

## Question Rule

V1 should ask one missing slot at a time by default.

Multiple missing slots can be asked together only when the missing details are
inseparable.

Good examples:

- `What should I open?`
- `Which repo should I start Puma for?`

Avoid:

- `What should I open, where, and how?`

## Resume Rule

The `resume_token` links the user's follow-up answer to the unresolved command.
Without the token, a follow-up should be treated as a new command unless the
active adapter session provides an equivalent safe correlation mechanism.

The token is short-lived conversational state. It is not durable memory, a task
queue, or approval.

A V1 resume token is valid only when all of these are true:

- same `actor_ref`
- same workspace
- same adapter session when the adapter provides session identity
- not expired, with the default TTL set to 300 seconds
- not used before

Consuming a resume token must be atomic. Only these state transitions may route
or close the resume attempt:

- `active -> used`
- `active -> expired`
- `active -> rejected`

If the token is already `used`, `expired`, or `rejected`, CommandDeck must not
route. The safe response is:

```text
That clarification is no longer active. Please give the command again.
```

V1 follow-up answers may fill missing slots only. The merged intent must
revalidate before any route can run.

The follow-up must not change:

- action
- risk tier
- permission level
- route
- capability source
- approval requirement
- any slot that was not listed in `missing_slots`

If the follow-up attempts one of those changes, CommandDeck should treat it as a
new command or return another CCQ. It must not silently rewrite the unresolved
command.

If the token is missing, expired, already used, or bound to a different actor or
workspace, CommandDeck should treat the follow-up as a new command or ask a fresh
CCQ. It must not attach the answer to the old command.

Example:

```text
User: Computer open dashboard activate
CommandDeck: Which dashboard?
User: SourceGrid production
```

The answer fills the missing object/context and then CommandDeck revalidates.

Counterexample:

```text
User: Computer open dashboard activate
CommandDeck: Which dashboard?
User: Actually restart Puma
```

This changes the action and target class, so it is not a resume fill. It must be
treated as a new command or another clarification.

## Local CLI Resume

The local CLI supports a minimal deterministic resume path:

```sh
npm run command:local -- ccq:resume --record-file records/actions/rec_example.json --resume-token ccq_example --command-pack contracts/commands/local-approved-commands.cdeck-pack.json "SourceGrid dashboard"
```

This path reads the saved action record, validates token binding, TTL, and
one-use status, fills the missing slot only, revalidates the merged command, and
then routes or fails closed.

When `--write-record` is used, local resume persistence is wrapped in a short
record lock so a consumed token is written before another resume attempt can
read and route it.

Fresh lock files fail safely without routing. Lock files older than 30 seconds
are considered stale and may be removed before retrying. Stale-lock cleanup may
remove only the `.lock` file, never the action record.

It does not call AppRelay, execute pack scripts, perform semantic rewrites, or
treat the follow-up as approval.
