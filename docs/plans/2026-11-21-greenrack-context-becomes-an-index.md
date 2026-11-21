---
status: active
branch: feat/greenrack-context-index
repos: [greenrack, dotfiles]
adrs: [decisions:ADR-0026, decisions:ADR-0075]
plan-id: p-01M7ZWJZRYG0TGFHRQJ4YSFKC2
---

# Greenrack context becomes an index

## Review panel

👉 **Decide:** none — approve if a short index plus a first-touch hook is the right way to load the design system.
📍 greenrack, dotfiles · 4 phases · 2 releases · next: Phase 1. Panel: architect, backend, python, typescript, po, tui, unix (all opus); codex not run.
**Changed by review:** the start directory comes from SessionStart input, not the transcript; the entry hook claims its marker atomically and fails open; the index and the whole output have size tests.
**Verdicts:** 7 approve-with-changes in round 1, then 7 approve or resolved; 10 carried; words 1047 → 1306 (×1.25); remove 0, merge 0.
📄 Full reviews: [2026-11-21-greenrack-context-becomes-an-index.reviews.md](2026-11-21-greenrack-context-becomes-an-index.reviews.md)

## Picture

```
 today                                  after this plan
 -----                                  ---------------
 session starts in ~/Developer/Perso    session starts in ~/Developer/Perso
   |                                      |
   +-- finds sub-repos 3 levels down      +-- cwd is no repo: prints nothing
   |                                      |
   +-- prints a 34 KB catalog             first file tool or Bash call in a
       (over the 10 KB hook cap,          consumer repo, once per session
       saved to a file, unread)             |
                                            +-- entry hook prints the index
                                            |   (about 5 KB, under the cap)
                                            |
                                            +-- agent wants detail:
                                                greenrack <Name>, MCP tool
```

No catalog at session start outside a repo; a short index arrives once, on the first touch of a design-system repo.

## Goal

`greenrack context` prints a short index instead of the 34 KB catalog. A session
started in a folder with no code (`~/Developer/Perso`) gets nothing at start,
and gets the index when its work first touches a repo that depends on
`@greenharness/greenrack-ui`.

## Non-goals

- Bumping `HOOK_MIN_CLI`: `hook install --check` drift in every consuming repo;
  their cached catalog refreshes within a week.
- Detecting a `cd` inside a Bash command: the first file tool call fires instead.
- Moving the entry hook into grh: design is not installed through grh here, so
  the `settings.json` entry is hand-placed and edited there (ADR-0075).

## Code review

The expert profiles that review the code at the close, beside
implementation-review (proposal: `greenbelay plan-panel --code-review`).

- greenrack: backend, lang:typescript, unix (tui, react and ui-design left out: one text block, no UI file; architect left out: only agents read the text)
- dotfiles: backend, lang:python, platform, architect (new entry.py module)

## Behaviour

- `greenrack context` and `greenrack hook session-start` print the index plus the
  cached doctor block. The index is at most 6,000 characters and the whole output
  at most 9,000 with a worst-case doctor block (tests hold both), under Claude
  Code's 10,000-character cap on hook context, so it is never saved to a file.
  Lines are at most 78 columns, with no ANSI escapes.
- The index holds: a one-line rule to look the design system up before building
  UI; the recipes; every component name; the guides line; and pointers to
  `greenrack <Name>` (props, usage, RELATED neighbours), `greenrack "<intent>"`,
  `greenrack <recipe> --source-only`, the `greenrack_lookup` MCP tool and
  `/greenrack-mockup`.
- `greenrack context --full` prints today's whole catalog, for a person. Its
  first line gives the size and names `greenrack context` for the short index.
- `--json` keeps `{preamble, entries, contrast, composition, doctor?}`; the
  manifest's `context` entry gains `full`.
- Outside a consumer, `greenrack context` says so on stderr in a terminal, and
  exits 0.
- The extension's `[[session_context]]` and `[[doctor]]` gates test the git root
  of the cwd, not folders below it, and look for `.claude/hooks/*-catalog.sh` in
  that root.
- On this laptop the settings SessionStart entry runs `entry.py --session-start`.
  It reads `session_id` and `cwd` from stdin and resolves the git root of the
  cwd; with no root, or no consumer there, it prints nothing. In a consumer it
  writes the marker for that root and, unless the repo has its own
  `.claude/hooks/greenrack-catalog.sh`, prints the index. No transcript is read.
- A PreToolUse hook on `Read|Edit|Write|MultiEdit|NotebookEdit|Bash` runs
  `entry.py`. It resolves the root of the touched path (`file_path`, or
  `notebook_path`, from the nearest existing folder; the cwd for Bash) and
  returns at once when that root's marker exists or the root is not a consumer
  (a cheap superset of the CLI's `isGreenrackConsumer`; the CLI run in the root
  decides). Otherwise it returns the index as `additionalContext`, prefixed by
  `greenrack index for <root> (first touch this session)`.
- Once, never twice: the marker is
  `$XDG_STATE_HOME/greenrack-entry/<session_id>/<agent>/<sha256 of root>`
  (`agent` is `agent_id` or `main`), created with `O_CREAT|O_EXCL` before `npx`
  runs and removed when `npx` fails. Markers older than 7 days are pruned; each
  decision logs one JSONL line there.
- Contract: stdout is empty, plain text (SessionStart) or one JSON object (PreToolUse); the exit code is always 0 (exit 2
  would block the tool); errors go to stderr. `npx` runs in the root under a 10 s
  limit inside a 15 s hook timeout; on timeout it removes the marker so the next
  call retries. The command to run is an argument, so `entry.py` names no
  greenrack package.
- The extension's `[[session_context]]` keeps its own command for grh installs:
  it resolves the git root of the cwd, exits when there is none, and runs the
  consumer test inside that root.

## Phases

- [x] Phase 1 — the index and `--full`: `packages/cli/src/catalog.ts`,
      `packages/cli/src/commands/context.ts`, `packages/cli/src/commands/hook.ts`,
      `packages/cli/src/bin.ts`, `packages/cli/src/manifest.ts`,
      `packages/cli/test/cli.test.ts`, `packages/cli/test/extension.test.ts`;
      one commit
- [x] Phase 2 — root-scoped gate and docs: `packages/cli/greenharness.toml`,
      `packages/cli/README.md`, `CLAUDE.md`, `AGENTS.md`; one commit
- [ ] Phase 3 — release v7.6.0 through the `tag-release` skill; the release
      writes the version from the tag into `packages/cli/package.json`,
      `packages/cli/greenharness.toml` and the other workspace manifests
- [ ] Phase 4 — the entry hook and the root-scoped SessionStart gate, first
      probing what PreToolUse sends for Read and Edit, in the main agent and in a
      subagent (its `agent_id` joins the marker key):
      `dot_claude/tools/greenrack-entry/entry.py`,
      `dot_claude/tools/greenrack-entry/test_entry.py`,
      `dot_claude/settings.json.tmpl`, `.chezmoiignore` (it lists `test_entry.py`);
      one PR from a `chezmoi-wt-*` worktree. The
      same files go live under ~/.claude first; the template is patched from them,
      never `chezmoi apply` over drift.

## Decision log

- 2026-11-21 — neighbour and compose tables leave the default: the RELATED block
  of `greenrack <Name>` (`format.ts`) already carries them, and they were two
  thirds of the size.
- 2026-11-21 — an index with detail fetched on demand is what decisions:ADR-0026
  decides for session context; the catalog broke it.
- 2026-11-21 — PreToolUse plus a marker, not `CwdChanged`, because
  `CwdChanged` cannot return context and no event fires on a file read.
- 2026-11-21 — `entry.py` in the laptop's tools, not in the CLI, because an
  `npx` start on every tool call costs seconds; the script checks cheaply and
  calls `npx` only on the first touch of a consumer.
- 2026-11-21 — `entry.py` is a laptop stopgap outside the extension manifest
  (ADR-0075); follow-up: propose a lazy-entry manifest key to grh. The
  SessionStart record replaces reading the transcript, whose first lines carry
  no `cwd`.
- 2026-11-21 — rejected: counting Perso-started sessions before Phase 4,
  because the person asked for this behaviour and the count would gate nothing.
- 2026-11-21 — Phases 1 and 2 land in one commit: the gate test in
  `extension.test.ts` passes only with the new manifest command, and the
  pre-commit hook runs the tests. Phase 1 was written by hand: relais could not
  admit its run in 1,800 s on a host at load 300 to 400 with eleven runs queued.
- 2026-11-21 — the Phase 4 probe settled the hook inputs: SessionStart sends
  `source` (`startup`, then `resume` on a resumed session with the same
  `session_id`), and a subagent's tool calls carry `agent_id` and `agent_type`
  under its parent's `session_id`. A `compact` with no repository now clears
  the session's markers too (a test caught the early return).

## Verification

- Phase 1: `greenrack context` in a fixture consumer → index under 6,000 characters,
  names `split-pane` and `greenrack_lookup`, no NEIGHBORS table, no line over 78
  columns, no ANSI; with a worst-case doctor block the whole output is under
  9,000; `dist/bin.js context --full` → today's text (so the option is wired);
  `hook session-start` equals `context --catalog-only`. Observed: the index is
  3,502 characters with its longest line at 78 columns and no escape; with a
  3,000-character doctor block the whole output stays under 9,000; `--full` is
  one header line then the old 31.1 KB catalog; the unit project and the
  typecheck pass.
- Phase 2: `greenrack context` run from `~/Developer/Perso` with the new gate
  command → empty stdout and stderr, exit 0. Observed: the manifest test runs
  both gate commands from a parent folder that holds a consumer repository
  (empty stdout and stderr, exit 0), from the repository and from a subfolder
  of it (the command runs).
- Phase 3: `npx -y @greenharness/greenrack-cli@7.6.0 --version` prints 7.6.0 and
  the index is under 6,000 characters and `context` under 9,000; in one consuming repo, with
  its hook cache cleared, `claude -p` shows the index inline, not saved to a file.
- Phase 4: `python3 -m unittest` (standard library only) feeds `entry.py`
  recorded stdin for each tool, the cwd-only case, a subagent call, two
  concurrent runs (one index), and a failing and a hanging `npx` (exit 0, empty
  stdout, marker removed); 100 later calls take p95 under 60 ms. Then `claude -p` started in `~/Developer/Perso` with a Read of
  a file in a consumer repo: no greenrack text at start, one index after the
  Read, none after a second Read, none for a file in `amont`, with empty stdout and stderr.
- Phase 4, mirror: `diff <(chezmoi --source <branch> cat ~/.claude/settings.json)
~/.claude/settings.json` is empty.

## Outcome

Filled when the plan closes. For 7 days after Phase 3, against the 7 before:
hook outputs saved to a file (target 0), and the share of `.tsx`-editing
sessions in a consumer that look a component up. A drop of a third returns the
neighbour tables.

<!-- panel: repos=greenrack,dotfiles adds=contract reviewers=architect,backend,lang:python,lang:typescript,po,tui,unix body-sha=218f913afba9 -->
