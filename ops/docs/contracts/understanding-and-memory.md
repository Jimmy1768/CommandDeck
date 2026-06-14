# Understanding And Memory

This document explains how CommandDeck decides whether it understands a
command, when it should ask a checking question, and how it can remember a
resolved meaning for later use.

## Core Rule

CommandDeck should not guess when it is confused.

It should do one of three things:

- route the command when the meaning is clear enough;
- ask a checking question when the meaning is not safe to infer;
- fail closed when the request is unsupported or unsafe.

## Spoken Command Convention

The V1 spoken convention is:

```text
<platform wake phrase>, <device code> <action> <object> [context] [end code]
```

For Siri, the platform wake phrase is usually `Hey Siri` or `Siri`, depending
on the user's device settings.

Example:

```text
Hey Siri, computer open ops dashboard activate
```

CommandDeck owns the phrase after the platform wake phrase:

- `device code`: spoken routing word, preferably `computer` for the local PC
  runner;
- `action`: what to do, such as open, close, find, start, stop, play, or pause;
- `object`: the app, service, dashboard, repo, device, workflow, or data view;
- `context`: any required details, such as repo, environment, where, what, or
  how;
- `end code`: optional phrase terminator, initially `activate`.

Users should provide as many parameters as the action needs. If a required
parameter is missing, CommandDeck should ask a concept-checking question instead
of guessing. End codes and voice invocation are not approval.

Calibration/help commands are the exception to the full operational grammar.
They are built-in read-only commands that explain CommandDeck itself, so they
may match relaxed deterministic phrases such as `help`, `what can you do`,
`show commands`, or `command structure`. For voice surfaces, the user still
needs to activate Siri or the relevant platform adapter first.

Calibration commands must not execute workspace actions, mutate settings,
approve anything, call AppRelay, or run custom-pack scripts. See
[Calibration Commands](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/calibration-commands.md:1).

The per-action source of truth is the
[Action Requirements Contract](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/action-requirements.md:1).
CommandDeck core owns generic action requirements; packs may declare
pack-specific requirements against the same schema.

Concept-checking questions are first-class non-executing responses. They use
`result.status: needs_clarification`, ask one missing slot by default, and carry
a `resume_token` so the user's answer can continue the unresolved command. See
[Concept-Checking Question Contract](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/concept-checking-question.md:1).

The resume answer is bounded. V1 follow-ups may fill missing slots only, and the
merged intent must revalidate before routing. A follow-up must not silently
change the action, route, risk tier, permission level, capability source,
approval requirement, or any slot that was not listed as missing. If it tries to
do that, CommandDeck should treat the utterance as a new command or ask another
checking question.

Resume tokens are short-lived conversational state. They are one use only and
valid for the same actor, same workspace, and same adapter session when session
identity is available. The default TTL is 300 seconds. Missing, expired, reused,
or unbound tokens must not attach a follow-up answer to an old command.

V1 stores CCQ state in the local action record. This supports separate
Siri/Shortcuts or CLI invocations without requiring AppRelay for deterministic
local clarification. The stored state is auditable local state only, not durable
memory, a task queue, or approval.

When AppRelay participates in capable-lane reasoning, CommandDeck uses the
SourceGrid runtime client contract: `client_type: internal_ops_tool`,
`client_key: commanddeck`, and `purpose: command_routing_reasoning`.

Consuming a resume token must be atomic. Only `active -> used`,
`active -> expired`, or `active -> rejected` may succeed. Duplicate or late
follow-ups against a terminal token must not route.

CCQ token lifetime and audit retention are separate. The active token TTL is 300
seconds, but expired or terminal CCQ records may be retained for audit for 7
days. V1 cleanup is manual and explicit only. Cleanup must not touch learned
memory.

## What "Understand" Means

CommandDeck understands a command when it can bind one safe, coherent intent
without inventing missing meaning.

That means it knows enough to answer:

- what action is requested;
- what target the action applies to;
- what route should handle it;
- whether approval is still required;
- whether the command is exact/local or needs capable reasoning.

## What "Confused" Means

CommandDeck is confused when any of these is true:

- the prompt is incomplete or corrupted;
- more than one interpretation is plausible;
- the words are clear but the action is operationally illogical;
- the command would require guessing the repo, service, environment, or target;
- the command is too vague to hand off safely.

## Risk Tiers

Understanding is risk-tiered. Higher-risk commands require more explicit
binding before CommandDeck may route them.

- `informational`
  - read-only and low-cost
  - examples: status checks, recent commits, what is running
- `local_control`
  - changes local desktop or app state, usually reversible
  - examples: open app, open dashboard, play, pause
- `workspace_mutation`
  - changes repo or workspace state
  - examples: start services for a repo, write a local file, run a mutable pack
    routine
- `delegated_agentic`
  - hands work to a capable runtime such as OperatorKit or AppRelay
  - examples: multi-step automation, codebase-touching workflow delegation

## When CommandDeck May Default Context

CommandDeck may default context only when there is exactly one reasonable
candidate in the active context and choosing it stays inside the acceptable
risk for that tier.

Good defaults:

- current machine;
- current workspace when only one workspace is active;
- current repo when only one repo is active;
- one clearly active service in the current workspace.

Bad defaults:

- picking among multiple repos;
- choosing between multiple dashboards or services;
- inferring environment for a mutable action;
- defaulting a pack mutation target from habit instead of active context.

## Core Versus Pack

CommandDeck has two capability sources:

- `core`
  - generic built-in actions owned by CommandDeck
  - examples: open, play, pause, repo status, process status
- `pack`
  - workspace-specific routines owned by a company, partner, or user
  - examples: SourceGrid workspace automation or personal operating scripts

This is separate from execution mode:

- exact/local/deterministic
- capable/AppRelay-mediated

Either core or pack commands may be exact/local or capable, depending on what
the command needs.

## Fast Lane, Capable Lane, Learning Layer

CommandDeck should follow this order:

1. `fast_lane`
   - deterministic parse first
2. `capable_lane`
   - escalate when deterministic parsing is not enough
3. human clarification
   - ask a checking question if capable reasoning still cannot produce one safe
     intent
4. learning writeback
   - store a resolved interpretation only after the resolution succeeds

The learning layer is not a live answer lane. It is post-resolution memory.

## What Should Be Learned

CommandDeck should learn stable interpretation patterns, not one-off outcomes.

Good candidates:

- phrase mappings;
- alias resolution;
- workspace-specific naming;
- repeated clarification outcomes;
- navigation defaults;
- prompt guards and refusal patterns.

Bad candidates:

- approval bypasses;
- secrets or credentials;
- one-off situational facts;
- broad "do what I usually mean" behavior;
- mutation-heavy defaults without clear scope and approval.

## Alias

CommandDeck uses two bounded alias forms:

- command phrase aliases in active command packs;
- target aliases in learned memory or slot resolution.

Neither form is chatbot understanding, and neither form grants execution
authority.

## Command Phrase Alias

A command phrase alias is an additional deterministic phrase owned by a command
pack command. It resolves to the same declared command contract as the command's
examples.

Examples:

- `puma status` can mean command `local.puma_status`;
- `check worker` can mean command `local.sidekiq_status`;
- `open current repo` can mean command `local.open_commanddeck_repo`.

Command phrase aliases are scoped to the active command pack. They must not
conflict after normalization. They do not change permission level, route,
required slots, allowed effects, or approval policy.

## Target Alias

A target alias is a short name for a target, not a hidden full command.

Examples:

- `source combatives homepage` can mean `pack.sourcecombatives.homepage.prod`;
- `ops dashboard` can mean `pack.sourcegrid.ops_dashboard.prod`;
- `worker` can mean `pack.sidekiq_service`;
- `focus music` can mean `core.focus_playlist`.

In V1, aliases resolve the target side of a command. The action should still be
spoken or supplied by an explicit command grammar.

Examples:

- `open ops dashboard` means action `open` against alias `ops dashboard`;
- `start worker` means action `start` against alias `worker`.

`ops dashboard` by itself should not silently mean "open ops dashboard" unless
CommandDeck has a separate explicit default-action rule for that grammar.

This is especially important for voice. Users should not be expected to speak
exact URLs, paths, or dashboard route strings. A pack should turn those strings
into named targets with voice-friendly aliases.

Target alias resolution is runtime-enabled for V1 core target-aware actions.
The fast lane can resolve an active-pack target alias as the object slot for a
core action such as `open`.

When a valid pack contains one logical target family with distinct dev/prod
aliases but no default environment, an underspecified phrase can produce a CCQ
instead of a pack rejection. The CCQ should present a bounded set of choices,
for example: `Do you mean source combatives dev or source combatives
production?`

Example:

```text
open source combatives homepage
```

should resolve as:

```text
action = open
target alias = source combatives homepage
target value = https://sourcecombatives.com
```

The target alias fills the object slot. It does not run a script by itself.

## Target Environment

Many URL targets have a dev and production form. CommandDeck should model those
as environment-specific targets rather than forcing users to speak exact URLs.

Examples:

- `sourcecombatives.homepage.dev` -> `http://localhost:3000`
- `sourcecombatives.homepage.prod` -> `https://sourcecombatives.com`

If the command is safe and the active pack has an explicit default environment,
CommandDeck may default. If the environment changes risk or side effects,
CommandDeck should ask a concept-checking question.

## Working Bookmarks

Users usually work with a small set of active pages, not every page in a web
app. A pack or local target registry may declare bookmark targets such as:

- `webpage one`;
- `admin users page`;
- `billing dashboard`;
- `local app`.

Codex can help populate these targets by copying exact URLs into structured
pack data. CommandDeck should consume the structured target registry; it should
not require raw spoken URLs or one script per page.

## Normalized Phrase

`normalized_phrase` exists so transcript text can match despite harmless capture
variation. It is not a reasoning layer.

V1 normalized phrases are stored and compared as lowercase text. Normalization
may remove punctuation, repeated spacing, small speech fillers such as `uh` and
`um`, and leading politeness such as `please`.

Normalization must preserve action, target, scope, risk, timing, and environment
words. It must not use synonyms, semantic similarity, embeddings, or LLM
paraphrase matching.

Reference:

- [Normalized Phrase Contract](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/normalized-phrase.md:1)

## Memory Write Confirmation

CommandDeck should not silently save memory.

After a resolution succeeds and the system determines it is learnable, it
should ask the user whether to save it.

V1 confirmation choices:

- save for this workspace
- save for this surface/workspace combination
- don't save
- forget later or replace existing memory

Replacement means the old memory is marked `superseded` and the new memory
becomes the only active memory for that same scope and match. CommandDeck
should not keep two active memories for the same phrase in the same scope.

## Resolved Intent

When CommandDeck saves a learned meaning, it should store the resolved intent in
a small routing-oriented shape.

V1 resolved intent fields:

- `action`
- `target_kind`
- `target_ref`
- `capability_source`
- `route`
- `risk_tier`
- `approval_required`
- optional `surface_ref`
- optional `context_bindings`

Machine-readable references:

- [Resolved Intent Contract](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/resolved-intent.md:1)
- [Learned Memory Item Contract](/Users/jimmy1768/Projects/CommandDeck/ops/docs/contracts/learned-memory-item.md:1)

`target_kind` is a small semantic enum:

- `app`
- `url`
- `dashboard`
- `repo`
- `service`
- `media`
- `device`
- `workflow`
- `data_view`
- `runtime`
- `delegate`

`target_ref` is a namespaced identifier, not a giant global enum. Examples:

- `core.current_repo`
- `core.music_app`
- `pack.sourcegrid_ops_dashboard`
- `pack.main_web_service`
- `delegate.apprelay`

## Why This Matters

This model lets CommandDeck get better with usage without becoming a guessing
system. It improves interpretation while keeping routing, approval, and safety
visible to the user.
