# SourceGrid Console Bridge Contract

SourceGrid Labs web console is the primary user-facing surface for SourceGrid
CommandDeck pack management.

The local CommandDeck runner remains the authority for local validation,
selection, routing, records, and execution boundaries.

The machine-readable contract lives at:

- `contracts/bridge/sourcegrid-console-bridge.schema.json`
- `contracts/bridge/sourcegrid-pack-selection.schema.json`

## Core Rule

The bridge is not a remote shell.

SourceGrid Labs may let the user browse packs, open one pack, view recent packs,
and see attachment or billing readiness. The selector targets a pack manifest
file and should filter for `*.cdeck-pack.json` only.

It must not send shell commands, scripts, secrets, env values, or executable
handlers to the local computer.

## V1 Bridge Mode

V1 should use pull-then-local-validate:

1. SourceGrid Labs records a pack selection manifest for the attached workspace.
2. The local CommandDeck runner pulls or receives that manifest through an
   explicit local sync step.
3. The local runner maps the selected pack to a configured control repo or local
   control folder.
4. The local runner validates the pack path stays inside that control root.
5. The local runner verifies the selected file ends in `.cdeck-pack.json`.
6. The local runner loads and validates exactly one command pack.
7. Only after local validation does the pack become the active pack for local
   command routing.

The SourceGrid selection is a candidate, not authority by itself.

Configured local control folders may be outside the CommandDeck repo when they
are declared as `local-folder` roots with `local_only: true`. This lets custom
packs stay version controlled in the user's or company's own git repo.

External custom pack roots should point at the owner repo or local control
folder root. The standard selector path is
`command-packs/<pack_slug>/<pack_slug>.cdeck-pack.json`.

## User Surfaces

SourceGrid Labs owns the normal user UX:

- browse available packs in configured control repos or folders;
- open one `*.cdeck-pack.json` manifest;
- show recent packs;
- show SourceGrid workspace attachment;
- show payment and AppRelay spend readiness;
- show CommandDeck help and calibration docs;
- show the Siri/Shortcuts plus MacBook V1 setup requirement;
- show the command prompt structure and examples.

These help surfaces are read-only. They may display CommandDeck-owned docs and
active-pack metadata, but they must not execute local actions, mutate settings,
approve commands, or send scripts to the local runner.

V1 user-facing help should explain two layers separately:

- first activate Siri using the platform wake phrase configured on the device,
  usually `Hey Siri` or `Siri`;
- then speak the CommandDeck phrase, such as `command help` or
  `computer open ops dashboard activate`.

CommandDeck CLI remains a developer/debug fallback:

```sh
npm run command:local -- pack:open --command-pack contracts/commands/core-commands.cdeck-pack.json
npm run command:local -- pack:recent
```

The CLI accepts the manifest path directly. The web console should present this
as a constrained file selector, not arbitrary file upload and not arbitrary
folder execution.

## Selection Manifest

A SourceGrid pack selection manifest must identify:

- `workspace_ref`;
- `actor_ref`;
- `pack_ref`;
- `pack_source_kind`;
- `control_root_ref`;
- `pack_path`;
- `selected_at`.

`pack_path` is relative to the configured control root and must point to a
`*.cdeck-pack.json` file.

For an external local control folder, `pack_path` is still relative to that
folder. The browser or console must not send an absolute manifest path as
authority.

The selector should present manifests from:

```text
command-packs/<pack_slug>/<pack_slug>.cdeck-pack.json
```

`pack_slug` uses lowercase kebab-case.

The manifest must not include executable fields, shell commands, scripts,
secrets, provider keys, approvals, or execute-now instructions.

Apply a downloaded/received selection manifest locally:

```sh
npm run command:local -- pack:apply-selection --config evals/fixtures/pack_discovery/local-control-folder.config.json --selection-file evals/fixtures/pack_selections/local-exact.selection.json
```

Persisting recent-pack UI state still requires `--write-state`.

## Authority Boundary

SourceGrid Labs can choose which pack the user wants.

CommandDeck local runner decides whether that pack is locally valid and safe to
use.

Route family decides dependencies. OperatorKit is required only for
`operatorkit.workflow` routes. AppRelay is required only for
`apprelay.reasoning` routes. Local core and custom-pack routes remain available
without either dependency when policy allows them.
