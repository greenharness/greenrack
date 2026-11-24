# Follow-ups noticed while working other tasks

## Destination

Each follow-up an agent noticed outside its own task is either done or ruled
out. One ticket per follow-up, filed from the repository inbox at a session
boundary.

## Notes

- Tickets here come from `.git/greenharness/inbox.md` (worktree-task Handoff).
  Each names the repository it is about; work it on that repository's own
  branch.

## Decisions so far

- [Visually hidden text stays inside its owner](f01-hidden-live-regions-containing-block.md): `AppShell.Main` with `scroll="main"` is positioned, rather than one positioned root per component (greenrack#229).
- [The Combobox story that loads on open passes under load](f03-combobox-story-flaky-under-load.md): the story held the load behind a promise instead of a 50 ms timer (greenrack#223).
- [The Combobox trigger labelled Close closes the list](f02-combobox-close-trigger-reopens.md): the trigger refocuses the input through the guard a choice already uses, so the focus does not reopen the list (greenrack#230).
- [The Field's aria-describedby names only mounted parts](f04-field-describedby-names-an-absent-description.md): Field.Description registers with its Root, and one `describedBy` on the context feeds all seven controls; the error id dangled too and is fixed with it (greenrack#231).
- [The Combobox reopens on ArrowDown after Escape and reads its Field](f05-combobox-escape-then-arrowdown-and-field-props.md): a closed-state listener opens the list on ArrowDown; Root puts Field `disabled` and `required` on the context for the input, trigger and hidden value (greenrack#234). Filed f10 and f11.
- [A native Combobox inside Field.Root is named by its Field.Label](f06-combobox-native-reads-field-label.md): Field.Label registers its text (with its necessity text) on the Field as `labelText`, and the native `Combobox.Input` takes it after `aria-label` (greenrack PR). Filed f12.
- [The session hook prefers the lockfile-pinned greenrack binary](f07-hook-prefers-the-local-greenrack-binary.md): the generated script runs the repo root's `node_modules/.bin/greenrack` when its version is in `^7.0.0`, else npx; the local version joins the cache pin and the doctor key (greenrack PR).

## Handoff

2026-11-24, boundary 3 (f07 closed: the generated SessionStart hook runs the repo root's lockfile-pinned `node_modules/.bin/greenrack` when its version is in `^7.0.0`, npx otherwise; minor changeset `hook-prefers-local-cli`. Consumers' `hook install --check` reads stale after the release until they rerun `hook install`). Next: f08, f09, f10, f11, f12.

## Not yet specified

## Out of scope
