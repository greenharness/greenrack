---
'@greenharness/greenrack-eslint-config': minor
'@greenharness/greenrack-cli': patch
---

`@greenharness/greenrack-eslint-config` now peer-depends on `@greenharness/greenspotter-eslint-config` (`>=0.20.1 <1`) in place of `@aval-adr/eslint-config`, the same package under its new name. Swap the dev dependency, import `base`, `effect` and `tests` from it, and rename `adrLint` / `adrLintTyped` to `greenspotter` / `greenspotterTyped`. The CLI's skills and `design-system-lookup` agent name `greentopo resolve` in place of `aval resolve`.
