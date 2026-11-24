---
'@greenharness/greenrack-ui': patch
---

`Input` and `Textarea` take their `Field.Root`'s `required` when their own `required` is unset, as they already took its `disabled`. Before, a `Field.Root required` showed the required indicator while its control was not required, so the browser let an empty form submit. An explicit `required={false}` on the control still wins.
