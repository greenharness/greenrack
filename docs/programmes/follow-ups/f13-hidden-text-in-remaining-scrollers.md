+++
type = "task"
mode = "afk"
status = "closed"
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

## Resolution

2026-11-25, greenrack PR. The patch changeset `hidden-text-remaining-scrollers` ships with the next
`@greenharness/greenrack-ui` release, beside f09 to f12's. Four of the eight scrollers let the text escape, and each is now
`position: 'relative'`: the AppShell `railBody`, `SteppedList`'s `rows`, the `Table`'s
`scrollX` and `CodeBlock`'s `pre`. The four popups were already contained: the `Popover`,
`Menu`, `Select` and `Listbox` popups are `position: fixed`, and each one is the scroller
itself.

Evidence: eight more test-only stories in `VisuallyHidden/InScrollers.stories.tsx` (17 in
all). The vertical ones reuse f08's `hiddenStaysInScroller`. The sideways ones use a twin,
`hiddenStaysInSidewaysScroller`. It puts the text after a `300vw` inline box on one line and
compares `scrollWidth` with `clientWidth`. The AppShell and Table stories run at a 1440 × 900
viewport, where the rail shows and the table does not stack. Before the fix, the four
unpositioned scrollers fail:

| Scroller            | offsetParent before    | Outer box before          | Document before |
| ------------------- | ---------------------- | ------------------------- | --------------- |
| AppShell `railBody` | the rail (`sticky`)    | rail height 2749 / 900    | 2749 tall       |
| `SteppedList` rows  | `body`, so the page    | document 2734 / 900 tall  | 2734 tall       |
| `Table` scroller    | the frame (`relative`) | frame width 5538 / 1440   | 5538 wide       |
| `CodeBlock` `pre`   | `body`, so the page    | document 3618 / 1200 wide | 3618 wide       |

After the fix, each scroller is the text's `offsetParent`. Each outer box equals its own size
(900, 900, 1440, 1200), and the document is the viewport (900 tall, 1200 or 1440 wide). The
four popups pass before the fix too: each one is the text's `offsetParent`, and the portal mount
around it measures 900 / 900. The scroller heights are Popover 2732 / 278, and Menu, Select and
Listbox 2745 / 278.

A first version of the Table story let the text wrap under the wide box inside its cell. It
failed only the `offsetParent` check, with the frame at 1440 / 1440. The stories now hold the box
and the text on one line, so the escape is measured, not inferred.

The 84 stories of the touched components pass (InScrollers, AppShell, SteppedList, Table and
CodeBlock). Nothing inside these parts was placed against the old box. The only absolutely
placed part in them is the SideNav marker in a rail, which sits against its own `relative`
item. The `Table`'s edge fades are in the frame, outside `scrollX`. In happier, duro-app,
application-landscape, social-planner and kb-vision, no file that uses these parts places
anything absolutely. happier's `CodeBlockViewFrame` is its own component, not greenrack's.

Not covered: `CodeBlock`'s diff rows (`lineAction` or `renderAfterLine`) scroll sideways through
a second scroller, `rows`. Content that `renderAfterLine` adds sits under its line at the left
edge, so hidden text in it does not reach past the edge. It is left unpositioned.
