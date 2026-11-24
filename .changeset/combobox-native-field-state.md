---
'@greenharness/greenrack-ui': patch
---

The native `Combobox.Input` reads its `Field.Root`'s `disabled` and `required`, as the web one does since the Field fixes. Inside a disabled Field the field opens no sheet, looks disabled and reports itself disabled to accessibility. React Native has no required state, so inside a required Field its accessibility label ends with " (required)", the text the web label reads, unless `Field.Label` already carries it (`necessityIndicator="label"`).
