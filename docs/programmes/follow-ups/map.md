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

- [Visually hidden text stays inside its owner](f01-hidden-live-regions-containing-block.md): `AppShell.Main` with `scroll="main"` is positioned, rather than one positioned root per component (greenrack#PR).
- [The Combobox story that loads on open passes under load](f03-combobox-story-flaky-under-load.md): the story held the load behind a promise instead of a 50 ms timer (greenrack#223).

## Handoff

2026-11-23, boundary 3 (f01 closed in greenrack#PR). Filed f08 (the same escape inside inner scrollers). Next: f02, f04, f05, f06, f07, f08.

## Not yet specified

## Out of scope
