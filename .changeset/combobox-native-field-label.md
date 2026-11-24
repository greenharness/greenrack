---
'@greenharness/greenrack-ui': patch
---

A native Combobox inside `Field.Root` is named by its `Field.Label`: the label registers its text (with its (required) or (optional) text) on the Field, and the native field takes it as its accessibility label after `aria-label`, with the shown value as its accessibility value.
