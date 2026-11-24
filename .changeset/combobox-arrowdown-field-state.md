---
'@greenharness/greenrack-ui': patch
---

`Combobox` on the web: ArrowDown on the closed field, after Escape for instance, opens the list again on the chosen option (else the first); it did nothing until the field was refocused. Inside `Field.Root`, a disabled Field now disables `Combobox.Input`, `Combobox.Trigger` and the hidden `name` input (so the value is not posted), with Select's disabled look; a required Field makes the input required, and `Field.Error` shows the browser's message on submit. Native Combobox reads neither yet.
