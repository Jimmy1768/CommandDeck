# Integration Boundaries

CommandKit routes to neighboring systems by contract. It does not embed their
internal behavior.

## AppRelay

CommandKit may ask AppRelay for LLM/runtime capability in later phases.
AppRelay remains responsible for provider selection, model routing, cost
controls, tool dispatch policies, provider credentials, and future generated
audio when needed.

Siri, Shortcuts, Google voice, and similar voice platforms are adapters, not
model/runtime providers for CommandKit. They may capture commands and speak or
play responses, but AppRelay remains the LLM/runtime path.

Slice 1 status: no AppRelay calls. Fixtures may describe an intended
`apprelay.summary` route, but validation requires `integration_mode` to be
`contract_only`.

## OperatorKit

CommandKit may request bounded workflow dry runs or dispatches after future
approval gates. OperatorKit remains responsible for execution queues, node
profiles, authority levels, returns, and execution records.

Slice 1 status: no OperatorKit calls. The dry-run MVP command is represented as
approval-required and blocked from execution.

## ManyMind

CommandKit may request deep review or source-packet preparation in later phases.
ManyMind remains the meeting, sleeve, source-packet, and decision-support
workspace.

Slice 1 status: no ManyMind calls. Source-packet work is draft-only in future
fixtures and not included in the first five MVP cases.

## Command Packs

Command packs are owned by the company or user repo that configures them. This
repo defines the pack contract but must not import SourceGrid-specific or
partner-specific scripts.
