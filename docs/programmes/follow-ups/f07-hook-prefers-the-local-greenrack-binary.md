+++
type = "task"
mode = "afk"
status = "closed"
blocked_by = []
repos = ["greenrack"]
+++

# The generated SessionStart hook prefers the lockfile-pinned greenrack binary

## Question

The generated SessionStart hook (`.claude/hooks/greenrack-catalog.sh`) runs `npx -y @greenharness/greenrack-cli@^7.0.0 doctor --session`, a registry-resolved CLI, while a consumer's commit gate runs the lockfile-pinned local `greenrack doctor` (happier's `greengate.conf` `greenrack-doctor` row). Two copies of one check can disagree between releases, and the `npx` path is slow or fails offline. Should the hook use `node_modules/.bin/greenrack` when present and `npx` only as the fallback? Raised by happier's chore/greenrack review (architect, backend).

## Look at

- `packages/cli/src/commands/hook.ts` and its generated script; `hook-migrate.test.ts` and `cli.test.ts` for what pins the script text

## Answer looks like

A generated script that runs the local binary when it exists, `npx` otherwise, with a test for both branches; `hook install --check` stays green on existing installs or says what to reinstall.

## Resolution

2026-11-24. Yes. The script sets `cli` once: `node_modules/.bin/greenrack` when it is executable and `node_modules/@greenharness/greenrack-cli/package.json` reads as an x.y.z inside `^HOOK_MIN_CLI` (same major, not below the floor), else `npx -y @greenharness/greenrack-cli@^7.0.0`. Both the catalog fetch and `doctor --session` run `bounded $cli …`, as words, not through a shell function, so the timeout still kills the real process.

- **Scope:** the repo root's `node_modules` only. That is where yarn 1 hoists a workspace's CLI (happier, whose `greenrack-doctor` gate row runs it) and where a root dependency lands under pnpm or npm. No consumer today has a workspace-only, unhoisted CLI. A prerelease, an unreadable version or a missing package.json keeps npx.
- **Caches:** the local version joins the catalog's pin line (`#greenrack-hook-pin 7.0.0 local 7.5.0`) and the doctor key, so a local upgrade refetches both. On npx both stay byte-identical to before, and existing caches stay valid.
- **`--check`:** the script text changed, so after this release an existing install reads as stale under `hook install --check`, which already names the command: `Run: npx -y @greenharness/greenrack-cli@^7 hook install`. The changeset says so.
- **Proof:** `hook-pin.test.ts` runs under sh and dash. It covers: a local CLI in range runs and npx does not, even when npx fails (offline); the floor itself; below the floor, a major above, a prerelease and an unreadable version fall back to npx; so does a `.bin` with no package.json; an upgrade refetches; a hung local CLI is killed at the timeout. Piloted on a scratch repo with the real built CLI behind a 7.9.0 package.json: a 61-line catalog, the doctor run locally, both keys carrying `local 7.9.0`, 1 to 2 s under sh and dash.
