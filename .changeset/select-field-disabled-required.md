---
'@greenharness/greenrack-ui': patch
---

`Select` follows its `Field.Root`'s `disabled` and `required`, as `Combobox` does. Inside a disabled Field the Select is disabled (the trigger does not open, and a `name`d Select posts no value) unless its Root sets `disabled` itself. A required Field makes the web trigger `aria-required`, and adds " (required)" to the native trigger's accessibility label unless the Field.Label's text already carries it.
