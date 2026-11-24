---
'@greenharness/greenrack-ui': patch
---

A callback ref you pass to `Textarea`, `Menu.Trigger`, `AppShell.Main`, or any part that merges refs (`Button`, `Toggle`, `Popover.Trigger`, ...) now hears when the element goes away. If it returns a cleanup (React 19), that cleanup runs on detach; if it returns nothing, it is called with `null`, as before. Before, the merged ref dropped the returned cleanup, so a ref that returned one was never told. An object ref is cleared on detach.
