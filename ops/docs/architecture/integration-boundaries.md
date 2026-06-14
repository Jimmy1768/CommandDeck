# Integration Boundaries

CommandDeck routes to neighboring systems by contract. It does not embed their
internal behavior.

The important architecture split is route family. CommandDeck routes by
capability, not by product dependency.

V1 route families:

- `core.local`: built-in computer/platform actions.
- `pack.local_read`: custom-pack read/status/query/draft commands.
- `pack.local_write_approved`: deterministic custom-pack writes after explicit
  approval.
- `apprelay.reasoning`: ambiguity resolution, summarization, generation, or
  other LLM-mediated work.
- `operatorkit.workflow`: workflow coordination, staged automation, heartbeat,
  handoff, and accountability.

AppRelay and OperatorKit are optional route dependencies. A custom pack does not
automatically require either one.

`pack.local_write_approved` has a concrete V1 route,
`local.pack_write_approved`, but that route is contract-only. It does not grant
write authority until a future pack-write policy is accepted.

## Codex

Codex remains the coding interface for repo reasoning, code edits, tests,
reviews, and implementation work. CommandDeck may help set up or inspect the
workspace around Codex, but it does not replace Codex and should not become a
voice-driven code editor.

Slice 1 status: no Codex calls. Any future command that asks Codex to open a
repo, summarize a task, or prepare a handoff must remain explicit and
permissioned.

## AppRelay

CommandDeck may ask AppRelay for LLM/runtime capability in later phases.
AppRelay remains responsible for provider selection, model routing, cost
controls, tool dispatch policies, provider credentials, and future generated
audio when needed.

CommandDeck calls AppRelay as a SourceGrid runtime client:

```text
client_type: internal_ops_tool
client_key: commanddeck
purpose: command_routing_reasoning
```

This is not a normal tenant assistant chat surface. CommandDeck sends task
metadata, constraints, risk, sensitivity, and required output schema. AppRelay
owns model/provider selection.

V1 AppRelay calls use SourceGrid full proxy. CommandDeck should not store a
long-lived AppRelay signing secret in the local CLI or receive a short-lived
AppRelay token in V1. SourceGrid is the authority for workspace attachment,
entitlement, billing readiness, and AppRelay spend policy, so SourceGrid
validates the request, binds scope proof, calls AppRelay, and returns the
bounded response to CommandDeck.

The CommandDeck-to-SourceGrid proxy endpoint is guarded by SourceGrid:

```text
POST /commanddeck/apprelay/reasoning
```

AppRelay can create cost, so CommandDeck must not enable AppRelay spend until a
SourceGrid workspace attachment and payment-method readiness check have passed.
SourceGrid is the billing anchor for AppRelay usage; owner repos are not.
SourceGrid credits gate AppRelay reasoning, generated audio, and other
SourceGrid-billed runtime routes only. Credit exhaustion must not disable voice
capture, platform TTS, deterministic local commands, local reads, local drafts,
or permitted local scripts.

Siri, Shortcuts, Google voice, and similar voice platforms are adapters, not
model/runtime providers for CommandDeck. They may capture commands and speak or
play responses, but AppRelay remains the LLM/runtime path.

Slice 1 status: no AppRelay calls. Fixtures may describe an intended
`apprelay.summary` route, but validation still keeps that path contract-only.

## OperatorKit

CommandDeck may route to OperatorKit when the selected route family is
`operatorkit.workflow`. This covers workflow coordination, staged automation,
heartbeat, handoff, and accountability.

OperatorKit is not a global CommandDeck dependency. Custom packs can use local
read/status/query routes, approved local write routes, or AppRelay reasoning
routes without OperatorKit.

If an OperatorKit route is selected and OperatorKit is not configured,
CommandDeck must return a blocked setup response. It must not fall back to shell
execution or silently substitute another route.

Slice 1 status: no OperatorKit calls. The dry-run MVP command is represented as
approval-required and blocked from execution.

## ManyMind

CommandDeck may request deep review or source-packet preparation in later phases.
ManyMind remains the meeting, sleeve, source-packet, and decision-support
workspace.

Slice 1 status: no ManyMind calls. Source-packet work is draft-only in future
fixtures and not included in the first five MVP cases.

## Command Packs

Command packs are owned by the company, user, or partner repo that provides the
workspace routines. This repo defines the pack contract but must not import
SourceGrid-specific or partner-specific scripts. Those repos are command-pack
sources, not the CommandDeck billing or entitlement authority.

For SourceGrid-owned usage, SourceGrid Labs web console is the primary pack
management surface. It may show pack catalogs, open one pack, and show recent
packs. The local CommandDeck runner remains the authority that maps that
selection to a configured control repo or folder, validates exactly one command
pack, and enforces local execution boundaries.

The SourceGrid console bridge is selection metadata only. It must not become a
remote shell, send scripts, send env values, or bypass local validation.

Workspace command packs may include PC-command routines such as opening apps,
switching devices, starting local services, or preparing drafts after future
execution boundaries are defined. Those routines belong in owner repos or
configured local folders, not in CommandDeck core.

At the same time, CommandDeck core may still own a default built-in action set
for the active platform target. In the current design that means Apple-first
computer-control primitives layered on top of Siri/Shortcuts capture, while
owner packs hold workspace-specific automation.
