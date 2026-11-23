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

## Handoff

2026-11-23, boundary 3 (f04 closed: a Field control's `aria-describedby` names only mounted parts, patch changeset `field-describedby-present-only`, released with the next greenrack-ui version; f02 merged as greenrack#230, f04 as greenrack#231, which filed f09). Next: f05, f06, f07, f08, f09.

## Not yet specified

## Out of scope
