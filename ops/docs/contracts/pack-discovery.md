# Pack Discovery Contract

CommandDeck can declare where command packs may be discovered. Phase 1 discovery
is metadata-only until the user selects one pack manifest and the local runner
validates it.

## Config Field

`command_pack_roots` is an optional array in `commanddeck.config.example.json`.
Each root declares a pack location. It does not grant execution or external
access by itself.

`default_command_pack` is the single active command pack for a command
invocation. Discovery roots are available pack locations only; they are not
simultaneous company or user profiles.

Required root fields:

- `id`;
- `kind`;
- `enabled`;
- `discovery_mode`.

Allowed `kind` values:

- `repo-fixture`: generic fixtures in this repository;
- `owner-repo`: a command-pack source repo such as `sourcegrid-labs` or a
  personal assistant repo such as `jimmys-assistant`;
- `local-folder`: a configured local command-pack folder.

Allowed `discovery_mode` values:

- `metadata_only`.

## Rules

- Discovery roots cannot contain executable fields such as `script`, `shell`,
  `handler`, or `executable`.
- Discovery roots cannot contain `env`, `secrets`, provider keys, or
  `execute_now_enabled`.
- Absolute local-folder paths are rejected unless the root is explicitly marked
  `local_only: true`.
- `repo-fixture` roots must stay under `evals/fixtures/command-packs`.
- `owner-repo` roots declare a `repo_slug`; CommandDeck does not crawl the repo
  in Phase 1.
- `local-folder` roots are local-only declarations. They may point at a user's
  or company's own git repo/control folder.

For custom packs, the control root should be the owner repo or local control
folder root. The standardized V1 catalog under that root is:

```text
command-packs/
  <pack_slug>/
    <pack_slug>.cdeck-pack.json
    README.md
    fixtures/
    scripts/
```

External custom selections must use
`command-packs/<pack_slug>/<pack_slug>.cdeck-pack.json`. `pack_slug` is
lowercase kebab-case.

Pack discovery does not call AppRelay, OperatorKit, ManyMind, GitHub, shell
scripts, provider APIs, or external services in Phase 1.

CommandDeck must not merge multiple company/person packs for one command.
Core covers generic computer control. The active pack covers one company,
person, or workspace profile at a time.

## Pack Selection Surface

Packs live inside a configured control repo or local control folder. CommandDeck
uses an app-like selection surface:

- `open`: validate one selected pack and make it the candidate active pack for
  the current context.
- `recent`: show recently opened packs from local CommandDeck state.

The default recent-pack state path is:

```text
.commanddeck/state/recent-packs.json
```

Recent-pack state is local UI state only. It is not a command pack, not memory,
not approval, and not execution authority.

The owner repo is where real scripts live. CommandDeck core owns the contract and
runner boundary; SourceGrid owns attachment and billing; the owner repo owns the
user's actual command packs and workspace routines.
