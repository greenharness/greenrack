---
'@greenharness/greenrack-ui': patch
---

A native Select inside `Field.Root` is named by its `Field.Label`: `Select.Trigger` takes the label's text as its accessibility label after `aria-label`, with the chosen item as its accessibility value, as the native Combobox does. Without either, the trigger still reads its shown value or placeholder.
