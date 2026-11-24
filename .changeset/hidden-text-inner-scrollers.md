---
'@greenharness/greenrack-ui': patch
---

The inner scrollers are positioned (`position: relative`): `ScrollArea.Viewport`, both `SplitPane.Pane`s, `Dialog.Body`, `Drawer.Body`, `Panel.Body` and `DetailPanel.Body`. Each one is now the containing block of what is absolutely placed inside it. Before, visually hidden text and live regions low in one of them (`VisuallyHidden`, `Spinner`'s label, `LiveRegion visuallyHidden`, the live regions of `TagGroup` and `DragDrop`) were placed against an outer box. In a `SplitPane` or a `Panel` that box was the page, so the document grew by the scroller's whole content height. In a `Dialog`, `Drawer`, `ScrollArea` or `DetailPanel` it was a clipped box, which a `focus()` or `scrollIntoView` could then scroll. An app's own absolutely placed child of one of these parts that has no positioned owner of its own is now placed against the part and scrolls with it. `VirtualList` and `Aside` were already positioned and are unchanged.
