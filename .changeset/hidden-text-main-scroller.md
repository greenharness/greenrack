---
'@greenharness/greenrack-ui': patch
---

`AppShell.Main` with `scroll="main"` is positioned (`position: relative`), so it is the containing block of what is absolutely placed inside it. Before, visually hidden text and live regions (`VisuallyHidden`, `Spinner`'s label, the live regions of `TagGroup`, `DragDrop` and `LiveRegion visuallyHidden`) were placed against the shell's container: one low on a tall page escaped the `main` scroller and lengthened the document, so the page scrolled twice. An app's own absolutely placed child of `Main` with no positioned owner of its own is now placed against `Main` and scrolls with it, instead of against the shell. `scroll="page"` is unchanged.
