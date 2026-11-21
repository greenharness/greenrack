---
'@greenharness/greenrack-tokens': minor
'@greenharness/greenrack-ui': minor
'@greenharness/greenrack-cli': patch
---

`ThemeProvider` `tokens` takes values per mode beside the groups: `light`, `dark` and `contrast: {light, dark}` (`ThemeTokensByMode`, validated by `validateModeTokens`, with the same refusals and floors in each entry, and a dropped entry naming its mode, `dark.colors.bg: …`). On the web they are emitted in CSS: under a `ColorModeProvider` on `system`, the provider it drives adds `prefers-color-scheme` blocks, and every provider adds a `prefers-contrast: more` block, so a server render paints the right values for the visitor's OS and contrast setting before hydration. `ColorModeProvider` takes `tokens` and forwards them to the provider it renders; a nested provider is pinned to its own theme. A nested provider's own flat value now beats an inherited per-mode value for the same key. Native takes the flat groups and the theme's mode. `greenrack mockup seed --overrides` reads the same file: each mode goes under its own theme selector (a dark-only value no longer reaches light or high-contrast), and `contrast` entries are noted on stderr, not applied. Flat-only `tokens` render exactly as before.
