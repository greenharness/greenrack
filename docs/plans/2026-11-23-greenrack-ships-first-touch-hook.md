---
status: active
branch: feat/greenrack-first-touch-hook
repos: [greenrack, dotfiles, decisions]
adrs: [decisions:ADR-0064, decisions:ADR-0073, decisions:ADR-0075]
plan-id: p-01M80J3H0J2PMKPCBGXMTM48B7
---

# Greenrack ships its own first-touch hook

## Review panel

👉 **Decide:** none — you chose Rust, Windows and amending ADR-0075 first; approve if the hook crate lives in greenrack.
📍 greenrack, dotfiles, decisions · 6 phases · 4 releases · 2 steps for you · next: Phase 0. Panel: architect, backend, rust, typescript, platform, po, tui, unix (all opus); codex not run.
**Changed by review:** grh reads status as JSON and a newer binary says `outdated`; the binary kills its process tree and exits 0 on a panic; the release checks the six npm names first and publishes the CLI last.
**Verdicts:** sh design: 6 seats, then a backend delta, approve. Rust rewrite: 4 seats approve-with-changes, then all 4 approve; 8 carried; words 1083 → 2071 (×1.91, mostly the rewrite you asked for); remove 0, merge 0.
📄 Full reviews: [2026-11-23-greenrack-ships-first-touch-hook.reviews.md](2026-11-23-greenrack-ships-first-touch-hook.reviews.md)

## Picture

```
 today                                   after this plan
 -----                                   ---------------
 dotfiles: entry.py (python3)            greenrack: first-touch (Rust)
   |  hand-copied to one machine           |  one binary per platform,
   |                                       |  shipped as npm packages
 greenrack-cli                           greenrack hook install --user
   (cannot reach ~/.claude)                |                 ^
                                           |                 |
 grh: skills, agent, MCP                 grh install design runs it
   (cannot install the hook)               (tool.machine, no grh code)
```

The hook becomes a compiled binary that greenrack ships and installs; grh runs that installer.

## Goal

Any machine, Windows included, gets the design-system index on first touch of a
consumer repo by running one greenrack command, with or without grh. The hot
path is a compiled Rust binary, shipped as greengate is. Installing the
`design` part through grh runs that same command. This laptop stops carrying a
private Python copy.

## Non-goals

- A change in grh: `{bin}` adopts any executable on PATH, `npx` included.
- npm as a tool source in grh: a later grh feature.
- A runner shared by several parts: a part ships its own hook (ADR-0073).
- grh on Windows: grh has none, so only the standalone install applies there.
- Porting the index logic to Rust: the binary decides whether to start the CLI,
  and the CLI renders the index.
- Changing the repo-level `hook install` or its generated hooks.

## Code review

The expert profiles that review the code at the close, beside
implementation-review (proposal: `greenbelay plan-panel --code-review`).

- greenrack: backend, lang:rust, lang:typescript, unix, tui, platform, architect
- dotfiles: none — a template and a deletion, proved by a diff
- decisions: none — no reviewed file type

## Behaviour

- `greenrack hook install --user` copies the platform's `greenrack-first-touch`
  binary, shipped in an npm platform package and found as greengate's shim
  finds its own, to `<claude>/hooks/`, and writes two exec-form entries in
  `<claude>/settings.json` that run it: SessionStart, and PreToolUse on
  `Read|Edit|Write|MultiEdit|NotebookEdit|Bash`, each with `timeout` 15. A
  wiring carries its matcher and timeout; `--check` compares both and that the
  binary answers `--protocol` with the version this CLI expects. A binary from
  another release prints `outdated` and stays present, so a newer 7.x never
  reads as absent. `<claude>` is `$CLAUDE_CONFIG_DIR`, else the home's `.claude`.
  It is idempotent, keeps the file's mode and a symlink's target, refuses
  invalid JSON rather than clobbering it, replaces a pasted
  `greenrack-cli@^7 context` SessionStart entry, and on a platform with no
  binary exits 2 without writing a hook that cannot run. `hook uninstall --user`
  removes those two entries and the binary, nothing else. A binary in use on
  Windows is renamed to `.old` before the new one lands (temp file and rename),
  and `.old` goes on the next run. Both print the paths
  changed and `restart Claude Code sessions`, say `already installed` or `not
installed` on a no-op, and keep lines under 80 columns.
- `--check` compares the entries' commands, not the bytes a newer release would
  generate. With `--json` it prints `{"state":"present"|"absent"}`. Exit 0
  present; 1 absent or differs, one line per entry; 2 invalid JSON, usage or no
  binary for the platform, nothing changed; 3 unreadable settings. grh reads
  the JSON, so a failed `npx`, which exits 1 and prints none, is unknown, never
  absent.
- The binary reads the event and exits 0 on a session or agent id not matching
  `[A-Za-z0-9_-]+`. The marker is the directory
  `<state>/<session>/<agent>/<root>/.m` (agent: `agent_id` or `main`; root: the
  nearest `.git` above the touched path, else the cwd for Bash, as a fixed-width
  FNV hash of the normalised root, with `\\?\` stripped and the drive letter and
  case folded on Windows, so the path stays under MAX_PATH; the root's text sits
  in a file inside). The binary reads only the event's ids and paths, never
  building a value for file content. A marker holding a `done` file,
  or claimed under 30 s ago, is a hit: exit 0. With no `package.json` within
  three levels naming `@greenharness/greenrack-` or `@duro-app/`, it writes
  `done` and exits. Otherwise it claims the marker (`mkdir`, or reclaims one
  abandoned over 30 s by renaming it to a unique name, then `mkdir`, so parallel
  reclaimers run once) and runs
  `npx -y @greenharness/greenrack-cli@^7.7.0 hook first-touch` (`npx.cmd` on
  Windows; fixed arguments, the event on stdin) under 10 s. A timeout kills the
  process tree: a process group and `killpg` (`libc`) on Unix, a Job Object
  (`windows-sys`) on Windows. Output is read on a thread under a deadline and
  printed only after exit 0. Success writes `done`; failure removes the marker
  and counts it; three in ten minutes back off. It always exits 0: the release
  profile unwinds, `catch_unwind` wraps `main`, which ends in `exit(0)`, and
  stdout errors are ignored. It handles no signal: a killed run leaves a claim
  that expires.
- `greenrack hook first-touch` holds the logic: it resolves the root, runs the
  exact consumer test (`isGreenrackConsumer`) and `runContext`, and prints plain
  text for SessionStart or one `hookSpecificOutput` JSON object for PreToolUse,
  prefixed `greenrack index for <root> (first touch this session)`, cut on a
  line at 9,500 characters with `[truncated; run: greenrack context]`, the JSON
  staying valid. It prints no skew warning or grh pointer. After a failed or
  backed-off call, the next SessionStart that works adds `greenrack index
unavailable (<reason>); run: greenrack hook install --user --check`.
- SessionStart with `source` resume, compact or clear clears the session's
  markers first. A repo with its own `.claude/hooks/greenrack-catalog.sh` keeps
  that hook: the marker is claimed and nothing is printed.
- State is under `${XDG_STATE_HOME:-$HOME/.local/state}/greenrack-first-touch/`
  (`%LOCALAPPDATA%` on Windows): markers pruned after 7 days, and a decision log
  trimmed at 1 MB that `--check` and `[[doctor]]` report from (last failure,
  back-offs).
- `greenharness.toml` declares `[tool] bin = "npx"` and `[tool.machine]`:
  install and uninstall run `{bin} -y @greenharness/greenrack-cli@^7.7.0 hook
install|uninstall --user`; status args are `-y
@greenharness/greenrack-cli@^7.7.0 hook install --user --check` (grh runs
  `{bin} <args>`) with `--json` appended, read as `json = ["state"]`.
  `[[session_context]]` goes, since the hook delivers it; `[[doctor]]` stays.

## Phases

- [ ] Phase 0 — amend ADR-0075 in the decisions repo: a part installs its own
      session hooks and grh runs its installer;
      `docs/adr/0081-a-part-installs-its-own-session-hooks.md` (0080 is taken; use
      the next free number), `docs/adr/HEADS.md`; one PR, merged before Phase 3
- [ ] Phase 1 — the binary and the command: `Cargo.toml`, `Cargo.lock`,
      `rust-toolchain.toml`, `crates/first-touch/Cargo.toml`,
      `crates/first-touch/src/main.rs`, `crates/first-touch/tests/contract.rs`,
      `packages/cli/src/commands/first-touch.ts`, `packages/cli/src/bin.ts`,
      `packages/cli/src/manifest.ts`, `packages/cli/test/first-touch.test.ts`,
      `greengate.conf`, `relais.toml`, `.github/workflows/ci.yaml` (cargo jobs on
      ubuntu, macOS and `windows-latest`, cached on `Cargo.lock`, run when
      `crates/`, `Cargo.*` or `ci.yaml` change); the dotfiles Python tests are the
      spec, mapped case by case to a contract test or `n/a (Python)`
- [ ] Phase 2 — packaging, as greengate does: `npm/platform/package.json.in`,
      `scripts/build-platform-packages.mjs` (sets the CLI's six optional
      dependencies to the tag's exact version), `packages/cli/package.json`
      (optional dependencies, `files`), `packages/cli/src/native.ts` (finds the
      platform package, glibc or musl; `GREENRACK_FIRST_TOUCH_BIN` names a binary
      first; win32-arm64 and linux-arm64-musl are unsupported, exit 2),
      `.github/workflows/release.yaml` (six targets; a preflight refuses the run
      unless `npm view` finds all six names; platform packages publish first and
      the CLI last, with `--provenance`, from artifacts checked against
      `SHA256SUMS`, so a resume reuses them; a `dry_run` input publishes nothing)
- [ ] Phase 3 — install, uninstall, check and the manifest:
      `packages/cli/src/commands/hook.ts`, `packages/cli/greenharness.toml`,
      `packages/cli/test/hook-user.test.ts`, `packages/cli/test/extension.test.ts`
      (its `parseToml` learns dotted and inline tables, `GRH_V1_KEYS` gains `tool`),
      `packages/cli/README.md`, `CLAUDE.md`, `AGENTS.md`; one commit
- [ ] Phase 4 — release v7.7.0 through the `tag-release` skill; the release
      writes the version into `packages/cli/package.json`,
      `packages/cli/greenharness.toml` and the other workspace manifests
- [ ] Phase 5 — this laptop leaves the Python copy: `dot_claude/settings.json.tmpl`,
      `.chezmoiignore`, and the deletion of the folder `dot_claude/tools/greenrack-entry/`
      (the script and its test); one PR from a `chezmoi-wt-*` worktree. The two
      Python entries leave the live `settings.json` first, then `greenrack hook
install --user` writes the new ones and the template is patched from the
      result

### 🧑 Your steps

- `npm publish --access public --tag reserved` of a `0.0.0-reserved` placeholder for each of the six `@greenharness/greenrack-first-touch-<platform>` names — because trusted publishing cannot create a package, and it needs your 2FA
- set each name's trusted publisher on npmjs.com (org `greenharness`, repo `greenrack`, workflow `release.yaml`) — because only the package owner can; both before Phase 2 merges, or the next tag's preflight fails

## Decision log

- 2026-11-22 — greenrack owns and installs its hook; grh runs greenrack's
  installer through `[tool.machine]`, because decisions:ADR-0064 has grh call a
  tool's own install and never write its hooks, and ADR-0073 keeps each part
  standalone.
- 2026-11-22 — no grh change: `bin = "npx"` is adopted from PATH
  (`grh/src/install.rs`, `owner.rs`).
- 2026-11-23 — the person asked for Rust and for Windows compatibility, so the
  hot path is a compiled binary, not sh or Node. Interleaved empty starts were
  48 ms for sh, 101 for Python and 260 for node; the binary is measured in
  Phase 1. It needs neither `sh` (a plain hook command runs in Git Bash or
  PowerShell on Windows) nor Node. Windows takes exec form, an `.exe`, hashed
  marker paths and a Job Object for the tree kill. It ships as greengate does: per-platform npm packages,
  including `win32-x64`, as optional dependencies of the CLI. The crate lives in
  the greenrack repo because greenrack owns its hook; a repository of its own
  stays possible.
- 2026-11-22 — `[[session_context]]` leaves the manifest because the hook
  covers SessionStart; two deliverers would print the index twice.
- 2026-11-22 — the laptop keeps its Python hook until Phase 5, so nothing is
  unwired meanwhile.
- 2026-11-22 — the person chose to amend ADR-0075 first (Phase 0): it has grh
  own the SessionStart entry, which grh only prints today.

## Verification

- Phase 1: the 36 behaviours of the Python tests pass against the binary, as
  Rust integration tests with a fake `npx`, on the macOS, Linux and
  `windows-latest` jobs; the event fixtures include `\` and a drive letter, which
  Claude Code's docs do not show. On macOS and Linux a release-build hit on a
  1 MB Write event is within 10 ms of an empty `sh -c :` at the median, measured
  interleaved, and spawns nothing (a failing `npx` first on PATH changes
  nothing). A claim left by SIGKILL is reclaimed after 30 s, once, by 50
  parallel calls; a fake `npx` forking a sleeping grandchild returns within the
  bound plus 1 s on all three jobs; a forced panic exits 0 with empty stdout. A
  cold `npx` (empty `npm_config_cache`) is timed against the 10 s cap.
- Phase 2: a `dry_run` dispatch builds the six platform packages and publishes
  nothing; each one's `os` and `cpu` match its name, and the CLI's optional
  dependencies equal the version; `npm pack` of the CLI lists the six optional
  dependencies; the resolver picks the right package under mocked platforms,
  glibc and musl, and refuses `win32-arm64` and linux-arm64-musl.
- Phase 3: with `GREENRACK_FIRST_TOUCH_BIN` naming the Phase 1 build (nothing is
  published before Phase 4), on a temporary `CLAUDE_CONFIG_DIR`, install,
  reinstall, check, entry drift, uninstall and invalid JSON behave as above,
  and other entries survive. `--check` exits 0, 1, 2 and 3 as above; under a
  simulated 7.8.0 with another binary it says `outdated` and still exits 0. On
  `windows-latest` an install while the hook binary runs succeeds.
- Phase 4: the published 7.7.0 passes `hook install --user --check` after an
  install and fails it before; a `claude -p` session started in
  `~/Developer/Perso`, hooked through `--settings` from that install, gives
  nothing at start, one index on the first read in a consumer, none on the
  second, none for a file in `amont`. With 7.7.0 published, `grh install
--extension <unpacked package> --yes` with `XDG_STATE_HOME` and
  `CLAUDE_CONFIG_DIR` in a temporary folder places both entries, `grh status`
  shows the part installed, `grh uninstall` removes them, and the real
  `~/.claude.json` and `settings.json` are byte-identical before and after. With
  the registry unreachable and an empty npm cache, `grh status` says unknown,
  not absent. When a Windows machine is at hand, one real event is dumped and
  added to the suite, and a real session runs the exec-form entries; until then
  the path form and the entries' acceptance on Windows are guesses.
- Phase 5: the template renders identical to the live `settings.json`; the same
  three-read session through the real wiring gives the same result.

## Outcome

Filled when the plan closes. Seven days after Phase 5, from the decision log:
first touches in a consumer that delivered an index (target 95%) and sessions
with two indexes (target 0). Below 90%, or when a hit adds over 10 ms, restore
the Python wiring and run `hook uninstall --user`.

<!-- panel: repos=greenrack,dotfiles,decisions adds=contract,lang:rust,ops reviewers=architect,backend,lang:rust,lang:typescript,platform,po,tui,unix body-sha=93130769c607 -->
