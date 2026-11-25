---
'@greenharness/greenrack-ui': patch
---

Four more scrollers are positioned (`position: relative`): the `AppShell` rail's body, `SteppedList`'s rows, the `Table`'s sideways scroller and `CodeBlock`'s `pre`. Visually hidden text and live regions low in one of them, or past its edge, were placed against an outer box. That box was the page for `SteppedList` and `CodeBlock`, and the rail or the `Table`'s frame for the other two, so the document grew: about 1,800px taller from the rail or the rows, and 2,400 to 4,100px wider from a `CodeBlock` or a `Table`. An app's own absolutely placed child of one of these parts with no positioned owner of its own is now placed against the part and scrolls with it. The `Popover`, `Menu`, `Select` and `Listbox` popups are fixed, so they were already contained, and are unchanged.
