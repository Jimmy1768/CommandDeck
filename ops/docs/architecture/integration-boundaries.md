# Integration Boundaries

CommandDeck routes to neighboring systems by contract. It does not embed their
internal behavior.

The important architecture split is:

- capability source: `core` versus `pack`;
- execution mode: exact/local versus AppRelay-mediated.

AppRelay is part of execution mode, not a replacement for the core/pack split.
Either a core action or a pack action may eventually need AppRelay when the
command is not exact enough to stay deterministic.

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

CommandDeck may request bounded workflow dry runs or dispatches after future
approval gates. OperatorKit remains responsible for execution queues, node
profiles, authority levels, returns, and execution records.

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
