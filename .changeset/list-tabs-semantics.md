---
'@greenharness/greenrack-ui': minor
---

`Tabs` and `List` carry the semantics their state needs:

- `Tabs.List` takes `aria-label` (or `aria-labelledby`, the id of a visible title) to name the tab list. Each `Tabs.Panel` renders an id and is labelled by its tab, and the active tab's `aria-controls` names that panel. Before, `aria-controls` pointed at an id nothing rendered. An inactive tab, whose panel is not rendered, names no panel.
- `List.Item` takes `expanded` on a pressable item (with `onClick`): its button gets `aria-expanded`, for a row that shows or hides what follows it.
- A selectable `List` (`selectionMode`) no longer puts `aria-selected` on `role="listitem"`, which ARIA does not support for that role. A pressable item's button carries the state instead: `aria-pressed` on the web, the `selected` accessibility state on React Native. A row whose control is its own (a `Checkbox`) carries it there.
