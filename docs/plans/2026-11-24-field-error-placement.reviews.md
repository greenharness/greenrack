# Full reviews: f112 field error placement

## Full reviews (reference)

- backend: round 1 approve-with-changes (adds=contract blocking, Verification, side anchor); round 2 and final approve (0.29.0 was wrong, all packages ship together); carried: eslint `20:` list gets the token appended, not a second key.
- typescript: approve-with-changes twice; tokens bump (high, applied); carried: token value, tolerance.
- react: approve-with-changes twice; upstream token (applied); carried: select the row button by name, `aria-describedby` contains the alert id.
- ui-design: approve-with-changes twice; reserve token and `paddingBottom` per row (applied); carried: pin line height.
- tui, unix: approve, no findings (web UI only).
- po: approve-with-changes; five token files and tokens bump (applied); carried: pass criterion for the longest message, After release section.
- codex: approve-with-changes, 3 medium, all carried: the story must conditionally mount `Field.Error` (a valid Field still renders explicit error content, `Field.tsx:378`); `Inline` takes no style, so wrap each row in an `html.div` for the `paddingBottom`; re-export `ErrorPlacement` from `index.ts` and `index.native.ts`.
- architect: approve-with-changes; API shape right (Field-only prop, minor); applied: four-package bump; carried: Field-only note.
