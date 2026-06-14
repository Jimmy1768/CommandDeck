# 0038: Calibration Commands Use Relaxed Grammar

Status: Accepted

## Context

CommandDeck's operational grammar asks users to say enough information for a
safe action:

```text
<platform wake phrase>, <device code> <action> <object> [context] [end code]
```

This is correct for actions that control the computer or workspace. It is wrong
for help commands. A user who asks "what can you do?" may not already know the
full CommandDeck command protocol.

## Decision

CommandDeck will treat calibration/help commands as a built-in command class
owned by CommandDeck core.

Calibration commands may use relaxed deterministic phrases such as:

- `help`;
- `what can you do`;
- `what commands can you understand`;
- `show commands`;
- `command structure`;
- `active pack`;
- `siri setup`.

They are available before active-pack classification and do not require the full
operational device/action/object/context/end-code grammar.

For voice surfaces, the platform wake phrase is still required. In V1, the user
must activate Siri first, then invoke CommandDeck through the configured
Shortcut/routing word.

## Boundaries

Calibration commands are read-only and may only print or open CommandDeck-owned
help content or summarize declared active-pack metadata.

They must not:

- execute workspace actions;
- run custom-pack scripts;
- mutate settings;
- approve actions;
- call AppRelay;
- make external network calls;
- infer hidden operational actions.

## Consequences

- Help works even when the user does not know the operational protocol.
- SourceGrid/user-facing surfaces can teach the Siri/MacBook V1 setup directly.
- Operational commands keep the stricter grammar and CCQ behavior.
- Runtime checks calibration phrases before pack command classification, but
  only for explicit `commanddeck.help.*` routes.
