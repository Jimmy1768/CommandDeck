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

An alias is a short name for a target, not a hidden full command.

Examples:

- `ops dashboard` can mean `pack.sourcegrid_ops_dashboard`;
- `worker` can mean `pack.sidekiq_service`;
- `focus music` can mean `core.focus_playlist`.

In V1, aliases resolve the target side of a command. The action should still be
spoken or supplied by an explicit command grammar.

Examples:

- `open ops dashboard` means action `open` against alias `ops dashboard`;
- `start worker` means action `start` against alias `worker`.

`ops dashboard` by itself should not silently mean "open ops dashboard" unless
CommandDeck has a separate explicit default-action rule for that grammar.

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
