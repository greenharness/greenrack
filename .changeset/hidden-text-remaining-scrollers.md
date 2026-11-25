---
'@greenharness/greenrack-ui': patch
---

Four more scrollers are positioned (`position: relative`): the `AppShell` rail's body, `SteppedList`'s rows, the `Table`'s sideways scroller and `CodeBlock`'s `pre`. Visually hidden text and live regions low in one of them, or past its edge, were placed against an outer box. That box was the page for `SteppedList` and `CodeBlock`, and the rail or the `Table`'s frame for the other two, so the document grew by the scroller's whole content: taller by the content below the fold of the rail or the rows, wider by the content past the edge of a `CodeBlock` or a `Table`. An app's own absolutely placed child of one of these parts with no positioned owner of its own is now placed against the part and scrolls with it. The `Popover`, `Menu`, `Select` and `Listbox` popups are fixed, so they were already contained, and are unchanged.
