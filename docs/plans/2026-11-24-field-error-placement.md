---
status: active
plan-id: p-01M86ERRXGJJZ8H6AJF06C1AS0
branch: feat/field-error-placement
repos: [greenrack, social-planner, decisions]
adrs: []
---

# f112: Field rows stay aligned when an error line appears

## Review panel

👉 **Decide:** none — approve if a hanging (out-of-flow) error with a token-sized reserve is the right fix.
📍 greenrack, social-planner, decisions · 4 phases · 2 releases · next: Phase 1 in a greenrack worktree. Panel: backend, typescript, react, ui-design, tui, unix, po, architect (opus); codex (gpt-6-astra).
**Changed by review:** side-label anchor and width rules; a `sizes.fieldErrorReserve` token with its five files; all four `@greenharness/greenrack-*` bumps to ^7.9.0.
**Verdicts:** 6 approve-with-changes, 3 approve (tui, unix, backend final); 17 carried (3 from codex); words 442 → 735 (×1.66, the high and blocking fixes); remove 0, merge 0.
📄 Full reviews: [2026-11-24-field-error-placement.reviews.md](2026-11-24-field-error-placement.reviews.md)

## Picture

```
 today (below)             hanging
 +-----+ +-----+ +---+     +-----+ +-----+ +---+
 |  A  | |  B  | |btn|     |  A  | |  B  | |btn|
 | err | +-----+ +---+     +-----+ +-----+ +---+
 +-----+  A sits lifted     err hangs, out of flow
```

Left: A's error enlarges its box, so A's input lifts above B and the
button. Right: the error hangs out of flow and the row stays aligned.

## Context

Since greenrack 7.4.0, `Field.Root` renders its error line (`Field.Error` or its own native-message line) as an in-flow child of the root column (`FieldLayout` and `Error` in `packages/ui/src/components/Field/Field.tsx`). In an `Inline align="end"` row the Field box grows by about 22 px, so `align-items:flex-end` lifts that input above its neighbours and the row's button. Affected social-planner rows: ReadyToPost (Mark posted date/time), PeriodsGates (add-period, add-gate), CalendarList. The person chose on 2026-11-21 to fix this upstream.

## Phases

- Phase 1, greenrack prop: `Field.Root` gets `errorPlacement?: 'below' | 'hanging'` (default `'below'`, unchanged) in `packages/ui/src/components/Field/Field.tsx`, threaded through `RootProps`, the inline prop types, `useMemo` objects and dependency lists of `ControlledRoot` and `StaticRoot`, `FieldContextValue`, and `FieldLayout` (an exported `ErrorPlacement` type), read by `Error` and `ownError` via `packages/ui/src/components/Field/FieldContext.ts`. `packages/ui/src/components/Field/styles.css.ts` gains `rootHanging` (`position: relative`, on `root`, or on `fieldContent` when `labelPosition="side"` so the error hangs under the control, not the label) and `errorHanging` (`position: absolute`, `top: 100%`, `left: 0`, `right: 0`, `marginTop: spacing.xs`, `pointerEvents: 'none'` so a wrapped line does not take the clicks of the row below); `role="alert"`, ids and `aria-describedby` stay. `packages/ui/src/components/Field/Field.meta.ts` documents the prop, the overlap trade-off, that a `Field.Description` stays in flow, and that the reserve covers one line. `packages/tokens` gains `sizes.fieldErrorReserve` (20 px: `lineHeight1` 16 px plus `spacing.xs` 4 px), never a borrowed spacing step, written in every place a size token lives, as `heroReserve` is: `packages/tokens/src/tokens/sizes.css.ts`, `packages/tokens/src/raw.ts`, `packages/tokens/src/keys.ts` (`SIZE_KEYS`, `SIZES_PX`), `packages/eslint-plugin/src/util/tokens.ts`, `packages/cli/registry.json`; `errorHanging` pins `lineHeight: typeScale.lineHeight1` so the reserve is exact. The prop lives on the Field only, not inherited from `Form`. Phase 3 uses the token. Worktree from `origin/main`; other sessions sit in the main checkout.
- Phase 2, story, proof, release: `packages/ui/src/components/Field/Field.stories.tsx` gets "InlineRowWithError" (three Fields and a Button in `Inline align="end"`, one invalid, `errorPlacement="hanging"`) with a toggle Button flipping `invalid` and a play test (by `getAllByRole('textbox')`, `getByRole('button')`, `getByRole('alert')`): bottom edges equal within 0.5px after `waitFor` with and without the error, the alert visible below its input and above the next sibling, the input's `aria-describedby` naming the error id. Further cases: `labelPosition="side"`, and the longest native message in an `fieldMinWSm` Field at 390. Run typecheck and tests, compile `packages/ui/src/index.native.ts`, run `amont agents-md`, check the story at 1280 and 390 with `browser-check`. PR, merge on green, release 7.9.0 with `tag-release` (new prop and token; every `@greenharness/greenrack-*` package publishes together from one tag).
- Phase 3, social-planner adoption: bump `@greenharness/greenrack-ui`, `@greenharness/greenrack-tokens` and the `@greenharness/greenrack-eslint-*` packages to `^7.9.0` in `package.json` (the token is new in tokens; `pnpm why` shows one tokens copy), read the 7.5 to 7.8 changelogs for what social-planner uses, run its typecheck and tests; set `errorPlacement="hanging"` on the Fields in the `Inline align="end"` rows of `app/components/editorial/ReadyToPost.tsx` (247, 266), `app/components/editorial/PeriodsGates.tsx` (105, 127, 255) and `app/components/editorial/CalendarList.tsx` (206, 226), with the room under each row: on the web `paddingBottom: calc(${typeScale.lineHeight1} + ${spacing.xs})` (it grows with the text; `sizes.fieldErrorReserve` is its default-size value for where there is no calc) (ReadyToPost's date/time row sits 16 px above the next form; PeriodsGates' rows sit in `Stack gap="sm"`, so each row gets that `paddingBottom` through `css.create`; a Stack gap key takes spacing steps only). PR, merge on green, deploy; browser-check each row at 1280 and 390 with an error shown.
- Phase 4, close the ticket: mark f112 done in `decisions/docs/programmes/follow-ups/f112-greenrack-field-row-alignment.md` and its line in `decisions/docs/programmes/follow-ups/map.md`.

Rejected: reserving error space on every Field (lifts the inputs above the button instead); an `Inline` mode that measures inputs (no CSS way).

## Verification

This PR (greenrack, Phases 1 and 2), observed in Chromium through `browser-check` on the stories at 1280 and 390, tree `e6ef1704`:

- `InlineRowWithError` (hanging), Toggle error on and off. Expected: the three inputs and the button have bottoms within 0.5 px. Observed: spread 0 px at 1280 and 390, both states; the alert's top is 84 (input bottom 80 + 4) and its bottom 100 equals the top of "Next row".
- `InlineRowWithErrorBelow` (default), error shown. Expected: the Field lifts, spread over 10 px. Observed: spread 22 px at both widths, so the test can fail.
- `HangingErrorSideLabel`. Expected: the alert's left edge equals the input's. Observed: delta 0 px, alert top 4 px under the input's bottom, at 1280 and 390.
- `InlineRowLongMessage`, a 3-line message in the row. Expected: row aligned, and the overlap documented. Observed: spread 0 px; the alert (height 48) reaches 32 px past the 20 px reserve into "Next row".
- `InlineRowWithError` with the web reserve `calc(lineHeight1 + spacing.xs)`, tree `04390bfa`, root font 16 px and 32 px (200%), 1280 and 390. Expected: spread at most 0.5 px; the reserve grows with the text. Observed: spread 0 px in all four; at 200% the next row starts 36 px under the input (the reserve), and "Required" wrapped to two lines (alert 64 px high), so its second line overlaps by 32 px: the documented limit, not the one-line case.
- `HangingNativeMessage` (the `ownError` path, 80 px Field), same tree, 1280 and 390. Expected: aligned row, message wrapped inside the Field's width. Observed: spread 0 px; the alert is 80 px wide (the input's width) and 32 px high, so it reaches 16 px past the reserve into "Next row": the documented limit. Text "Please fill out this field.".
- Unit suite on tree `6ac5ae6c`: 51 files, 913 of 914 tests pass; `popover.test.ts` "registry and CLAUDE.md are current" timed out at 60 s under host load 64 and passes alone, 4 of 4 (36 s). `build-registry.mjs --check` and `tsc` (web and native) pass; the Field stories pass in Chromium (28).

Owed to the social-planner PR (Phase 3), not this one: ReadyToPost Mark posted (date cleared, submitted), PeriodsGates add-period and add-gate, CalendarList, at 1280 and 390, native error under its input, bottoms equal, no overlap with the next row.

## Implementation review

- implementation-review: round 1 approve-with-changes (blocking Verification record, high format, native-message story: all fixed); delta 1 and 2 approve-with-changes (unit-run record, docs): fixed; final low on the unit-run line fixed here. About 5 reviews, 40-100 s each.
- backend, lang:typescript: round 1 approve-with-changes (native-message path untested; default and helper; test typing), all fixed; delta approve. react: approve (low: `pointerEvents`, fixed).
- ui-design (interface-review): round 1 HIGH (px reserve overruns at 200% text) fixed by the web reserve `calc(lineHeight1 + spacing.xs)`; final delta approve.
- Deliberate: `sizes.fieldErrorReserve` stays a px token (the size scale and its drift check are px-only), for native, where there is no `calc`; there it stays at 20 px when the text grows. A message past one line overlaps the next row (documented in `Field.meta.ts`).

## Non-goals

`Inline` stays unchanged; rows in `ChannelSettings.tsx`, `campaigns.tsx`, `feeds.tsx` are not touched unless they hold a Field with an error line (checked, then listed).

## Code review

- greenrack: backend, lang:typescript, react, ui-design (unix, tui left out: no CLI output change)
- social-planner: backend, lang:typescript, react, ui-design (unix, tui left out: no CLI output change)
- decisions: none — markdown only

<!-- panel: repos=greenrack,social-planner,decisions adds=ui,contract reviewers=backend,typescript,react,ui-design,tui,unix,po,architect body-sha=73d2c47adb32 -->
