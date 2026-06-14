# Calibration Commands

Calibration commands explain how to use CommandDeck. They are built into
CommandDeck core and are available before active-pack command classification.
The local runtime path is implemented for CLI and adapter request execution.

They are a separate class from operational commands:

- operational commands control the computer or workspace;
- calibration commands explain CommandDeck, active commands, active pack
  metadata, examples, and prompt structure.

## Relaxed Grammar

Calibration commands may use relaxed grammar because their purpose is to help a
user who does not yet know the full command protocol.

Valid examples:

```text
help
what can you do
what commands can you understand
show commands
command structure
how do I talk to CommandDeck
active pack
siri setup
```

For voice surfaces, the platform wake phrase is still required because
CommandDeck cannot hear the user until the platform adapter is active.

Example:

```text
Hey Siri, command help
Hey Siri, command what can you do
Hey Siri, command command structure
```

The strict operational form is not required for calibration commands:

```text
Hey Siri, computer open ops dashboard activate
```

That form remains the preferred pattern for commands that operate the computer
or workspace.

## Safety Boundary

Calibration commands are read-only. They may:

- open CommandDeck-owned help docs;
- print CommandDeck-owned help text;
- list declared active-pack commands and targets;
- show command prompt structure;
- show Siri/MacBook V1 setup requirements.

They must not:

- execute workspace actions;
- run custom-pack scripts;
- mutate settings;
- approve anything;
- call AppRelay;
- make external network calls;
- infer hidden operational actions.

If a phrase could be both help and operation, help wins only when the matched
route is one of the explicit `commanddeck.help.*` routes. Otherwise the normal
command grammar, CCQ, approval, and runner policy apply.

## V1 Siri Surface Explanation

V1 assumes Siri/Shortcuts plus a MacBook runner.

The user must activate Siri first using the platform wake phrase configured on
their device, usually `Hey Siri` or `Siri`. That wake phrase belongs to Apple,
not CommandDeck.

After Siri is listening, the user says the CommandDeck phrase. In V1:

- `command` is the adapter routing word for the Shortcut;
- `computer` is the preferred CommandDeck device code for the MacBook runner;
- `activate` is an optional end code, not approval.

Examples:

```text
Hey Siri, command help
Hey Siri, command command structure
Hey Siri, computer open ops dashboard activate
```

## Contract

Machine-readable contract:

- [Calibration Commands Schema](/Users/jimmy1768/Projects/CommandDeck/contracts/commands/calibration-commands.schema.json:1)
