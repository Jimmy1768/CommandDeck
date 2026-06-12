# Adapter Response Envelope

CommandDeck returns an adapter-facing response envelope with every local command
result. The envelope is for thin adapters such as Siri/Shortcuts, future Google
voice surfaces, and display clients.

## Fields

- `schema_version`: contract version, currently `0.1`.
- `adapter`: adapter id from the request or local default.
- `display_text`: text for visual display.
- `spoken_text`: text a voice adapter may speak with platform TTS.
- `record_ref`: action record id returned with the same result.
- `permission_level`: command permission level.
- `approval_status`: current approval status.
- `route`: selected route or `none`.
- `response_mode`: `platform_tts`, `display_text`, or `json`.
- `apprelay_audio_available`: always `false` in Phase 1.
- `apprelay_audio_ref`: `null` in Phase 1.
- `reasoning_owner`: `apprelay`.
- `platform_reasoning_used`: always `false`.
- `apple_intelligence_required`: always `false`.
- `google_reasoning_required`: always `false`.
- `errors`: adapter-safe error strings.

## Voice Behavior

For `requested_output: spoken_summary`, CommandDeck sets
`response_mode: platform_tts`. Siri/Shortcuts or a future Google voice adapter
may speak `spoken_text`. The adapter is not the reasoning layer.

For concept-checking questions, the adapter should set `display_text` and
`spoken_text` to the clarification question. The route remains `none`, approval
status remains `required_not_requested`, and no action executes.

Future AppRelay-generated audio can add an audio reference after that capability
exists. Until then, adapters speak text.

## Approval Behavior

Approval-required commands return a spoken/displayable blocked response. Voice
invocation is not approval. The adapter response points to the action record
through `record_ref`; it does not execute the action.

Missing optional dependencies also return spoken/displayable blocked responses.
The spoken/display text should include setup guidance and the authoring fix
hint from the action record result.
