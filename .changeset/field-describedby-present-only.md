---
'@greenharness/greenrack-ui': patch
---

A control in a `Field.Root` no longer points `aria-describedby` at an element that is not there. It names the description id only while a `Field.Description` is mounted, and the error id only while an error line is showing (a mounted `Field.Error`, or the native message the Field shows itself). Before, it always named the description id, and named the error id whenever the Field was invalid. One value on the Field context now drives `Input`, `Textarea`, `ColorInput`, `Select.Trigger`, `Combobox.Input`, `TagGroup` and the group controls.
