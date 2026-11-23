+++
type = "task"
mode = "afk"
status = "closed"
blocked_by = []
repos = ["greenrack"]
+++

# Visually hidden text stays inside its owner

## Question

7.2.1 (#208) made `Switch`, `Checkbox` and `RadioGroup.Item` the containing block of
their hidden native input. Other users of `visuallyHidden.base` (`position: absolute`)
have no positioned owner either: the live regions of `TagGroup` and `DragDrop`,
`Spinner`'s `srOnly` label, and `VisuallyHidden` itself. Inside `AppShell` with
`scroll="main"`, one placed low on a tall page takes `AppShell`'s positioned container
as its containing block. It then escapes the `main` scroller and lengthens the
document, as the switches did in happier. Two fixes are possible. Each owning
component could get a positioned root. Or a positioned `AppShell.Main` could contain
every case at once, though it would also change the containing block of any
absolutely placed child an app puts in `main`. Pick one.

## Look at

- `packages/ui/src/styles/visually-hidden.css.ts` and its users (`git grep 'visuallyHidden\.'`)
- `packages/ui/src/components/AppShell/AppShell.tsx` (the container and `AppShell.Main`)
- the story assertion #208 added (`offsetParent === closest('label')`) as the pattern for a test

## Answer looks like

A story per affected component inside an `AppShell` with `scroll="main"`, placed below
the fold. It asserts `document.documentElement.scrollHeight === innerHeight`, red before
the fix and green after, and the fix is released. Or each component is ruled out with
the measurement that shows it cannot escape.

## Resolution

2026-11-23, greenrack#PR. Picked the positioned `AppShell.Main`: under
`scroll="main"`, Main is `position: relative`. The per-component option cannot
cover every case. `VisuallyHidden` has no owner it could make positioned,
`DragDrop.Root` renders no element, and `LiveRegion visuallyHidden` (which
`git grep 'visuallyHidden\.'` misses, because it imports the style as `hidden`)
is in the same position. `scroll="page"` is unchanged: there the document is
the scroller, and an element at its static position cannot lengthen it.

Evidence: five test-only stories in `AppShell.stories.tsx`
(`ScrollMainHolds*`: VisuallyHidden, Spinner's label, the TagGroup, DragDrop
and LiveRegion live regions). Each puts its owner below a `300vh` spacer in a
`scroll="main"` shell and asserts `offsetParent === main` and
`documentElement.scrollHeight === innerHeight`. Before the fix all five fail.
The first assertion finds the shell's container instead of `main`. With that
assertion removed, the document measures 2725 px against a 900 px viewport.
After the fix all 30 AppShell stories pass.

Consumer impact: happier is the only app using `scroll="main"`. Its three
absolutely placed elements under Main (`PetTileGrid`, `LoadingIndicatorPreview`,
`PetSprite`) each sit inside a `position: relative` owner, so none of them
changes containing block.
