# Pack Discovery Contract

CommandKit can declare where command packs may be discovered in later phases.
Phase 1 discovery is metadata-only.

## Config Field

`command_pack_roots` is an optional array in `commandkit.config.example.json`.
Each root declares a future pack location. It does not grant execution or
external access.

Required root fields:

- `id`;
- `kind`;
- `enabled`;
- `discovery_mode`.

Allowed `kind` values:

- `repo-fixture`: generic fixtures in this repository;
- `owner-repo`: an attached owner repo such as `sourcegrid-labs` or a personal
  assistant repo such as `jimmys-assistant`;
- `local-folder`: a configured local command-pack folder.

Allowed `discovery_mode` values:

- `metadata_only`.

## Rules

- Discovery roots cannot contain executable fields such as `script`, `shell`,
  `handler`, or `executable`.
- Discovery roots cannot contain `env`, `secrets`, provider keys, or
  `execute_now_enabled`.
- Absolute paths are rejected unless the root is explicitly marked
  `local_only: true`.
- `repo-fixture` roots must stay under `evals/fixtures/command-packs`.
- `owner-repo` roots declare a `repo_slug`; CommandKit does not crawl the repo
  in Phase 1.
- `local-folder` roots are local-only declarations and remain disabled by
  default in examples.

Pack discovery does not call AppRelay, OperatorKit, ManyMind, GitHub, shell
scripts, provider APIs, or external services in Phase 1.

The owner repo is where real scripts live. CommandKit core owns the contract and
runner boundary; the attached repo owns the user's actual command packs and
workspace routines.
