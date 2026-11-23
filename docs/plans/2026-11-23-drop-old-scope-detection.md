---
status: done
plan-id: p-01M83KVH44FXHV7JGXV1F7QVKV
branch: chore/drop-old-scope-detection
repos: [greenrack, grh, adr-lint]
adrs: []
---

# Drop the old design-system scope from detection (greenrack-rename t13)

## Review panel

👉 **Decide:** none — approve if a minor `v7.8.0` (not a major) is right: the tag sets every package version and consumers pin `^7`.
📍 greenrack, grh, adr-lint · 3 phases · 3 releases · next: Phase 1. Panel: backend, lang:rust, lang:typescript, tui, unix, architect, po (opus).
**Changed by review:** release became a minor `v7.8.0`; Phase 1 gained the missed test files and importers; grh and adr-lint got concrete fixture and test changes.
**Verdicts:** 2 approve, 4 approve-with-changes after round 2; 19 carried; words 488 → 764 (×1.57, concrete misses, backend blocking fix); remove 0, merge 0.
**Carried into implementation:** doctor's line goes to stderr, never under `--json` or `--session`, at most 80 columns (`--json` cannot tell an unswept app from a non-consumer; accepted); doctor exit 0 for a non-consumer is deliberate; Order step 2 checks each tag and registry version; add the SessionStart guard to Verification; adr-lint's changed refusal in release notes; pin `npx -y @greenharness/greenrack-cli@7.8.0 skill install`; grh negative audit test and exact adr-lint assertions (exit 0, file bytes, greenrack import still refused); remove the `"duro"` key; name the allowlist path for the test literal; Code review line says architect is seated for `adds=contract`.
📄 Full reviews: [2026-11-23-drop-old-scope-detection.reviews.md](2026-11-23-drop-old-scope-detection.reviews.md)

## Picture

```
 today                                   after this plan
 -----                                   ---------------
 app(@duro-app/ui)   --> detected        --> not a consumer
 app(@greenharness/*) --> ok              --> ok
 old hook wiring     --> migrated        --> migrated (stays)
```

An app on the old scope used to be detected by doctor, grh, adr-lint and the
SessionStart guard; after this plan it is not, while old wiring still migrates.

## Context

The fleet is swept (t08, t08b closed; recount 2026-11-23: no primary checkout
under ~/Developer/Perso depends on `@duro-app/*`, only stale worktrees).
greenrack 7.x still recognises `@duro-app/*`, `duro-prose`, `--duro-`,
`data-duro`. That window is over, and t10's census cannot reach zero while
detection names them. The installers' migration of old hook entries and skill
copies STAYS.

## Decision: release size

Minor: tag `v7.8.0`. `release.yaml:58-66` sets every package's version from
the tag, and a check pins CLI floors to the release's major. A major would
republish ui, tokens and eslint-\* as 8.0.0 for an unchanged UI, and every
consumer pins `greenrack-cli@^7` (hook, skills, `greenharness.toml`): swept apps
would stay on 7.x, which still has the old detection, until each reinstalls.
The removed support has no present user. grh and adr-lint each get a minor
release.

## Phases

- [x] Phase 1 — greenrack drops the old scope (PR, then release `v7.8.0`):
      `packages/cli/src/legacy-names.ts` (delete the detection constants and the
      doc block at lines 16-19; only `doctor.ts` and `test/doctor-scopes.test.ts` import the detection names; `hook.ts`, `skill.ts` and the migrate tests keep importing the migration names),
      `packages/cli/src/commands/doctor.ts` (`SCOPES` is the greenrack scope alone,
      kept here so `bin.ts` and `commands/mockup.ts` need no edit; `legacy-names`
      finding and `LEGACY_CSS_NAME` go),
      `packages/cli/src/commands/context.ts` (line 161 note: no `@duro-app/ui`
      mention, ends with the install command, stderr and TTY-only),
      `packages/cli/src/skill-template.ts`, `packages/cli/greenharness.toml`,
      `packages/cli/agents/design-system-lookup.md` (gates and agent name the new
      scope only), `packages/cli/test/doctor-scopes.test.ts` (single-scope suite;
      new test: a literal `@duro-app/ui` dependency is not a consumer),
      `packages/cli/test/cli.test.ts` (skew warning for the old scope goes, on
      purpose), `packages/cli/test/extension.test.ts` (note text),
      `scripts/rename-allowlist.txt` (migration names, and the doctor-scopes test's literal `@duro-app/ui`). Doctor prints one line
      naming `@greenharness/greenrack-ui` and the install command; exit stays 0;
      `--session` stays silent. Low findings 3 (two `--check` lines over 80
      columns), 4 (recheck line without `@^7`) and 8 (comment on an empty catch)
      ride along (3 and 8 were not done, see the Decision log); the other six
      stay deliberate. Gate:
      `rg 'LEGACY_(UI|TOKENS|CLI)_PACKAGE|LEGACY_PROSE|LEGACY_CSS|LEGACY_DATA'`
      finds nothing; `hook-migrate` and `skill-migrate` pass unchanged. Regenerated, not hand-written: `packages/cli/registry.json`, `packages/cli/skills/*/SKILL.md` and `.claude/skills/*/SKILL.md` follow `skill-template.ts` (`build-registry --check` passes).
- [x] Phase 2 — grh drops its `dep:@duro-app/` rule, minor release:
      `catalog.toml`, `tests/audit_golden.rs` (delete the `duro` and `both_scopes`
      fixtures and the old-scope assertion at :450; rename the test),
      `tests/fixtures/audit/duro.json`, `tests/fixtures/audit/both_scopes.json`,
      `tests/fixtures/audit/expected-new.json` (settle the `"duro"` key),
      `tests/fixtures/greenrack-greenharness.toml` (a 7.x snapshot: stays
      byte-identical, see the Decision log). The byte-identical v1 fixture
      stays.
- [x] Phase 3 — adr-lint `DS_PACKAGES` refuses an `adrLint` import from any source but `@aval-adr/eslint-config` (amended in review, see the Decision log),
      minor release: `src/sync/typescript.rs` (also rename `duro_package`,
      `duroimported`, `duro_adr_lint_imports`), `tests/sync_typescript.rs` (the
      retired-scope test stays a refusal, exit 1 and the file unchanged, and a
      `./local-lint.js` case joins the greenrack one). Parallel with Phase 2.

Machine follow-through, not a phase (config outside the repositories, after
`npx @greenharness/greenrack-cli@^7 --version` reports 7.8.0): the
`@duro-app/` needle in `~/.claude/settings.json` (lines 59, 225) and chezmoi
`dot_claude/settings.json.tmpl` (patch the template, never `chezmoi apply`
over the laptop); the gate lines of
`~/.claude/skills/{ui,colors,typography,greenrack-mockup}/SKILL.md` via
`greenrack skill install`. The `--own-hook .claude/hooks/duro-catalog.sh`
entry (settings.json:229) stays as migration, named in the allowlist. The
`@^7.6.0` pins need no change.

## Order

1. greenrack PR → merge on green → `v7.8.0` (tag-release), verify npm.
2. grh and adr-lint PRs in parallel; neither needs the greenrack release.
3. Machine follow-through, template first.
4. Close t13 in decisions; handoff names t10.

## Verification

Phase 1, observed 2026-11-23 on the built CLI (`packages/cli/dist/bin.js`):

- Temp app with only `@duro-app/ui`: `greenrack doctor` → exit 0, stderr one
  line of 76 columns (`not a greenrack consumer; to become one: pnpm add
@greenharness/greenrack-ui`), stdout empty. `--json`: stdout
  `{ok:true, findings:[], …}`, stderr 0 bytes. `--session`: 0 bytes. `context`
  piped: 0 bytes. The pty run of `context` could not be made here (`script`
  has no tty on this host); the note's text and 80-column cap are pinned in
  `extension.test.ts`, the TTY and `--json` gate is the one line in `bin.ts`.
- `pnpm -C packages/cli exec tsc --noEmit` exit 0; `vitest --project unit`
  50 files, 911 tests passed (`doctor-scopes`, `extension`, `cli`,
  `hook-migrate`, `skill-migrate`); `check-rename-allowlist.sh` exit 0;
  the `rg` gate for the deleted constants finds nothing.
- grh, observed on `de30a9c`: `cargo test --test audit_golden` passes; with
  the old catalog rule restored the new test fails. adr-lint, on `270e8d8`:
  `cargo test --test sync_typescript` passes; the retired-scope import, a
  `./local-lint.js` import and the greenrack import are each refused (exit 1,
  file unchanged).
- Released and read back: greenrack `v7.8.0` (all five packages on npm, and
  `npx @greenharness/greenrack-cli@7.8.0 doctor` in a `@duro-app/ui`-only app
  prints the one-line note), grh `v0.15.0` (crates.io, 6 release assets, the
  tap's `stable`), adr-lint `v0.19.0` (npm, 5 release assets, the tap).
- Machine: `~/.claude/settings.json`, the dotfiles template (dotfiles#73), the
  four skill gates and the `design-system-lookup` agent hold no `@duro-app`.
  The pty run of `greenrack context` was never made (no tty on this host);
  its text and 80-column cap are pinned by `extension.test.ts`.

## Non-goals

A deprecation notice for old-scope apps (release notes name the removed
names: `@duro-app/*`, `duro-prose`, `--duro-`, `data-duro`); retiring
migration code; the `duro-stack` aval scope (history); duro-app itself; t10's
census and archiving `duro-design-system`.

## Code review

- greenrack: backend, lang:typescript, unix, tui (architect left out: no new contract)
- grh: backend, lang:rust (unix, tui left out: no output change)
- adr-lint: backend, lang:rust (unix, tui left out: no output change)

## Decision log

- 2026-11-23 — Low findings 3 (two `--check` lines over 80 columns) and 8 (a
  comment on an empty catch) are not done: the nine findings' list was not
  recoverable to a line, and nothing in this diff touches `hook.ts` or
  `skill.ts`. Finding 4 (recheck line `@^7`) is done. The `@^7` stays hard
  coded: `cliVersion()` reads 1.0.0 in the tree, the release sets versions
  from the tag, and `greenharness.toml` hard-codes `@^7` too.
- 2026-11-23 — `SCOPES` stays a one-element list (a second scope is not
  expected; `bin.ts` and `mockup.ts` keep importing it unchanged).
- 2026-11-23 — Phase 3 is amended. `DS_PACKAGES` naming the greenrack config
  only would have made `adr-lint sync` accept an `adrLint` import from
  `@duro-app/eslint-config` (it exported `adrLint` from 5.33.0) and write a
  second binding. The rule refuses an `adrLint` specifier from any source
  other than `@aval-adr/eslint-config` (adr-lint#66, 0.19.0).
- 2026-11-23 — grh's `tests/fixtures/greenrack-greenharness.toml` stays a
  byte-identical 7.x snapshot, not a comment edit (grh#63).
- 2026-11-23 — A flaky Storybook story failed the first land; fixed in
  greenrack#223 and closed as follow-up f03.

## Implementation review

- implementation-review: approve after the delta; plan findings and the `isTTY` flag argument fixed; 58k + 60k tokens.
- backend: approve after the delta; `--json` quiet, test and comments fixed.
- lang:typescript: approve-with-changes; `Scope.kind` removed, titles fixed; deliberate: one-element `SCOPES`; the TTY gate in `bin.ts` has no test of its own, kept to avoid a fourth review round.
- unix: approve after the delta; context note unprefixed (76 columns), `context --json` quiet.
- tui: approve-with-changes; same low as typescript, deliberate: the test title "to nobody else" now checks the note text only.

<!-- panel: repos=greenrack,grh,adr-lint adds=contract reviewers=backend,lang:rust,lang:typescript,tui,unix,architect,po body-sha=9a101e6813d4 -->
