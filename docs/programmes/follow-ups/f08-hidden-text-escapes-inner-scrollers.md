+++
type = "task"
mode = "afk"
status = "open"
blocked_by = []
repos = ["greenrack"]
+++

# Visually hidden text stays inside inner scrollers

## Question

f01 made `AppShell.Main` with `scroll="main"` the containing block of visually hidden text.
The same escape is still possible inside the other scrollers: `ScrollArea.Viewport`,
`SplitPane.Pane`, `VirtualList`, a `Dialog` or `Drawer` body, and `Aside`. Each is
`overflow: auto` and may have no position. Take a `VisuallyHidden`, a `Spinner` or a
`LiveRegion visuallyHidden` placed low in one of them. It is placed against the next
positioned ancestor. After f01 that is Main, so it lengthens Main's scroll rather than the
document's. Which of these scrollers are positioned already? For each one that is not,
should it be positioned?

## Look at

- `git grep -n "overflowY: 'auto'\|overflow: 'auto'" packages/ui/src`, then check `position` on the same style
- the `ScrollMainHolds*` stories in `AppShell.stories.tsx` (f01) as the test pattern

## Answer looks like

For each scroller, either a story that puts hidden text below its own fold and asserts that
its `offsetParent` is the scroller and the outer `scrollHeight` is unchanged (red before the
fix, green after, released), or the measurement that shows the scroller is already contained.
