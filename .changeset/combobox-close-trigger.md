---
'@greenharness/greenrack-ui': patch
---

`Combobox.Trigger` labelled "Close" now closes the list on the web. The click moved focus to the trigger and its refocus of the input reopened the list; the trigger now returns focus to the input without opening it, so typing still works.
