+++
type = "task"
mode = "afk"
status = "open"
blocked_by = []
repos = ["greenrack"]
+++

# Visually hidden text stays inside the remaining scrollers

## Question

f08 positioned the scrollers that hold an app's content: `ScrollArea.Viewport`, the `SplitPane`
panes, and the `Dialog`, `Drawer`, `Panel` and `DetailPanel` bodies. It also measured
`VirtualList` and `Aside`, which were already contained. Other elements are still `overflow: auto`
with no position of their own:

- the AppShell rail's body (`railBody`);
- `SteppedList`'s rows;
- the scrolling list inside the `Popover`, `Menu`, `Select` and `Listbox` popups;
- the `Table` container and `CodeBlock`'s `pre`, which scroll sideways.

For each, can visually hidden text or a live region end up inside it, below its fold or past its
edge? When it can, does the text escape to an outer box (a longer document, or a clipped popup
that `focus()` can scroll)?

## Look at

- `packages/ui/src/components/VisuallyHidden/InScrollers.stories.tsx` (f08): the probe and its
  `hiddenStaysInScroller` check. For the sideways scrollers, compare `scrollWidth` instead.
- each owner's styles, for whether the scroller is itself the fixed or absolute popup. If it is,
  it is positioned already.

## Answer looks like

For each scroller, a story in `InScrollers.stories.tsx`. The story is red before a
`position: 'relative'` fix and green after it, and the fix is released. Or the story is green
from the start, and its numbers are recorded in the Resolution.
