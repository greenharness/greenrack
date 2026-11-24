---
'@greenharness/greenrack-ui': patch
---

`Checkbox`, `Switch` and `Slider` read their `Field.Root`, as `Input` does. Inside one, the control takes the Field's control id, so `Field.Label` names it (for `Checkbox` and `Switch`, clicking the label toggles it; the `Slider` thumb is not labelable and names itself by `aria-labelledby` from a mounted label instead). `Field.Description` and `Field.Error` reach it through `aria-describedby`, the Field's `invalid` sets `aria-invalid`, and the Field's `disabled` applies when the control's own `disabled` is unset. Before, inside a Field each was unnamed unless given `aria-label` or children, and the Field's description and error did not reach it. On React Native, `Field.Label`'s text is the accessibility label of a `Checkbox` or `Switch` with no `aria-label` and no children, and of a `Slider` after its `aria-label` and string children. A `Checkbox` or `Switch` with children inside a Field is named by both labels: give it no children there.
