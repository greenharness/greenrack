+++
type = "task"
mode = "afk"
status = "open"
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
