# 0017. CCQ Resume Answers Fill Missing Slots Only

Date: 2026-06-12

## Status

Accepted.

## Context

CommandDeck can pause with a concept-checking question when a command is
understood enough to continue but lacks a required detail.

The follow-up answer creates a safety edge case. A user might answer the exact
missing detail, but they might also accidentally change the command, risk, or
target class. If CommandDeck treats every follow-up as a free-form new command,
the `resume_token` loses value. If it treats every follow-up as permission to
rewrite the command, a clarification can silently become a different action.

## Decision

V1 CCQ resume answers may fill missing slots only.

The follow-up answer must be correlated to the unresolved command by
`resume_token` or an equivalent safe adapter-session mechanism.

The merged intent must revalidate before routing.

The follow-up must not change:

- action
- risk tier
- permission level
- route
- capability source
- approval requirement
- any slot that was not listed in `missing_slots`

If the follow-up attempts to change one of those fields, CommandDeck must treat
it as a new command or return another CCQ. It must not silently mutate the
original command.

## Consequences

- CCQ is a bounded clarification mechanism, not a hidden command editor.
- Voice replies stay safe even when the user gives a broad or confusing answer.
- CommandDeck can later support richer corrections, but that requires an
  explicit command-rewrite contract.
- Adapters should preserve the resume token during the clarification turn, but
  they still do not own reasoning or approval.
