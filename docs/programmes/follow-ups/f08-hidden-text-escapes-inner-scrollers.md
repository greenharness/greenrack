+++
type = "task"
mode = "afk"
status = "closed"
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

## Resolution

2026-11-24, greenrack PR. Six of the eight scrollers were not positioned. Each of them is now
`position: 'relative'`: `ScrollArea.Viewport`, both `SplitPane.Pane`s (`primary`, `secondary`),
`Dialog.Body`, `Drawer.Body`, `Panel.Body` and `DetailPanel.Body`. The last two were not on the
ticket's list but have the same shape. Two were already contained: `VirtualList`'s scroller is
`relative` and `Aside` is `sticky`.

Evidence: nine test-only stories in `VisuallyHidden/InScrollers.stories.tsx`. Each places a
`VisuallyHidden` after a `300vh` spacer in one scroller. It checks that the scroller has a fold
(`scrollHeight > clientHeight`) and that the scroller contains the text's `offsetParent`. It also
checks that the nearest positioned box around the scroller (or the document) has nothing to
scroll. Before the fix, seven of the nine fail:

| Scroller                  | offsetParent before            | Outer box `scrollHeight` / height before |
| ------------------------- | ------------------------------ | ---------------------------------------- |
| `ScrollArea.Viewport`     | the Root (`overflow: hidden`)  | 2701 / 280                               |
| `SplitPane.Pane` (either) | `body`, so the page            | document 2701 / 900                      |
| `Dialog.Body`             | the popup (`overflow: hidden`) | 2773 / 763                               |
| `Drawer.Body`             | the panel                      | 2768 / 900                               |
| `Panel.Body`              | `body`, so the page            | document 2798 / 900                      |
| `DetailPanel.Body`        | the content box                | 2806 / 900                               |

After the fix, each scroller is the text's `offsetParent` and every outer box equals its height
(280, 900, 763, 900, 900, 900). The two that were already contained measure:

- `VirtualList`: 2725 / 280. The text sits against its row (`position: absolute`), which is
  inside the scroller, so the story checks containment rather than `offsetParent === scroller`.
- `Aside`: 2701 / 852, with the document at 900.

The 161 stories of the touched components pass. Two Drawer touch-drag stories timed out at 15 s
in that parallel run. They passed alone, and again in a run of all 44 Drawer stories.

The two kinds of escape do different harm. In a `SplitPane` or a `Panel`, the page itself
scrolls further. In a `Dialog`, `Drawer`, `ScrollArea` or `DetailPanel`, the outer box clips, so
nothing shows. But that box now has content to scroll, so a `focus()` or a `scrollIntoView` can
push its header and footer out of view.

Consumer impact: happier, duro-app, application-landscape and social-planner use these parts in
about 110 places. One element changes containing block: social-planner's `AddLinkDialog.tsx:89`.
It is a `LiveRegion visuallyHidden` in a `Dialog.Body` with no positioned owner, which is exactly
the case this fix corrects. Every other absolutely placed element in those repositories either
already has a positioned wrapper of its own or is not inside one of these parts. For happier,
only the files that contain absolute positioning were checked.

Not covered here: the rail body, `SteppedList`'s rows, the popup lists and the sideways
scrollers. They are filed as f13.
