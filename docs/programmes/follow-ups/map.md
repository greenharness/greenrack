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
- [Visually hidden text stays inside inner scrollers](f08-hidden-text-escapes-inner-scrollers.md): `ScrollArea.Viewport`, both `SplitPane` panes and the `Dialog`, `Drawer`, `Panel` and `DetailPanel` bodies are positioned; `VirtualList` and `Aside` already were (greenrack PR). Filed f13.
- [Checkbox, Switch and Slider read their Field](f09-checkbox-switch-slider-read-the-field.md): each takes the Field's control id, description, error, invalid and disabled as `Input` does; the Slider thumb names itself by `aria-labelledby` (not labelable); native takes `labelText` (greenrack PR). Filed f14.
- [Input and Textarea take Field's required](f10-input-textarea-read-field-required.md): each takes `required ?? ctx?.required` beside its `disabled` fallback; an explicit `required={false}` wins (greenrack PR).

## Handoff

2026-11-24, boundary 3 (f10 closed: `Input` and `Textarea` take their `Field.Root`'s `required` when their own is unset; `required={false}` still wins. Patch changesets `checkbox-switch-slider-read-field` and `input-textarea-field-required`, unreleased). Next: f11, f12, f13, f14.

## Not yet specified

## Out of scope
