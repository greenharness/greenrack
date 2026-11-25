---
'@greenharness/greenrack-ui': minor
'@greenharness/greenrack-tokens': minor
---

ThemeProvider under a `system` ColorModeProvider emits the DS light theme's colours and shadows under `prefers-color-scheme: light`, so a key the app's `tokens` leave out (a `keepDefault` key) is right on a light OS before hydration. Keys the flat tokens set stay as they are. The `<style>` is now emitted without `tokens` too. `@greenharness/greenrack-tokens/raw` exports `lightShadows`.
