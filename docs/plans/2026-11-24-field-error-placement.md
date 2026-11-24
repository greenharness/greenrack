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

- Phase 1, greenrack prop: `Field.Root` gets `errorPlacement?: 'below' | 'hanging'` (default `'below'`, unchanged) in `packages/ui/src/components/Field/Field.tsx`, threaded through `RootProps`, the inline prop types, `useMemo` objects and dependency lists of `ControlledRoot` and `StaticRoot`, `FieldContextValue`, and `FieldLayout` (an exported `ErrorPlacement` type), read by `Error` and `ownError` via `packages/ui/src/components/Field/FieldContext.ts`. `packages/ui/src/components/Field/styles.css.ts` gains `rootHanging` (`position: relative`, on `root`, or on `fieldContent` when `labelPosition="side"` so the error hangs under the control, not the label) and `errorHanging` (`position: absolute`, `top: 100%`, `left: 0`, `right: 0`, `marginTop: spacing.xs`); `role="alert"`, ids and `aria-describedby` stay. `packages/ui/src/components/Field/Field.meta.ts` documents the prop, the overlap trade-off, that a `Field.Description` stays in flow, and that the reserve covers one line. `packages/tokens` gains `sizes.fieldErrorReserve` (20 px: `lineHeight1` 16 px plus `spacing.xs` 4 px), never a borrowed spacing step, written in every place a size token lives, as `heroReserve` is: `packages/tokens/src/tokens/sizes.css.ts`, `packages/tokens/src/raw.ts`, `packages/tokens/src/keys.ts` (`SIZE_KEYS`, `SIZES_PX`), `packages/eslint-plugin/src/util/tokens.ts`, `packages/cli/registry.json`; `errorHanging` pins `lineHeight: typography.lineHeight1` so the reserve is exact. The prop lives on the Field only, not inherited from `Form`. Phase 3 uses the token. Worktree from `origin/main`; other sessions sit in the main checkout.
- Phase 2, story, proof, release: `packages/ui/src/components/Field/Field.stories.tsx` gets "InlineRowWithError" (three Fields and a Button in `Inline align="end"`, one invalid, `errorPlacement="hanging"`) with a toggle Button flipping `invalid` and a play test (by `getAllByRole('textbox')`, `getByRole('button')`, `getByRole('alert')`): bottom edges equal within 0.5px after `waitFor` with and without the error, the alert visible below its input and above the next sibling, the input's `aria-describedby` naming the error id. Further cases: `labelPosition="side"`, and the longest native message in an `fieldMinWSm` Field at 390. Run typecheck and tests, compile `packages/ui/src/index.native.ts`, run `amont agents-md`, check the story at 1280 and 390 with `browser-check`. PR, merge on green, release 7.9.0 with `tag-release` (new prop and token; every `@greenharness/greenrack-*` package publishes together from one tag).
- Phase 3, social-planner adoption: bump `@greenharness/greenrack-ui`, `@greenharness/greenrack-tokens` and the `@greenharness/greenrack-eslint-*` packages to `^7.9.0` in `package.json` (the token is new in tokens; `pnpm why` shows one tokens copy), read the 7.5 to 7.8 changelogs for what social-planner uses, run its typecheck and tests; set `errorPlacement="hanging"` on the Fields in the `Inline align="end"` rows of `app/components/editorial/ReadyToPost.tsx` (247, 266), `app/components/editorial/PeriodsGates.tsx` (105, 127, 255) and `app/components/editorial/CalendarList.tsx` (206, 226), with the Phase 1 `sizes.fieldErrorReserve` token under each (ReadyToPost's date/time row sits 16 px above the next form; PeriodsGates' rows sit in `Stack gap="sm"`, so each row gets `paddingBottom: sizes.fieldErrorReserve` through `css.create`; a Stack gap key takes spacing steps only). PR, merge on green, deploy; browser-check each row at 1280 and 390 with an error shown.
- Phase 4, close the ticket: mark f112 done in `decisions/docs/programmes/follow-ups/f112-greenrack-field-row-alignment.md` and its line in `decisions/docs/programmes/follow-ups/map.md`.

Rejected: reserving error space on every Field (lifts the inputs above the button instead); an `Inline` mode that measures inputs (no CSS way).

## Verification

- Story `InlineRowWithError`, invalid: input and button bottoms differ by 0 px (about 22 px with `'below'`, so the test can fail).
- Side-label story, invalid: the error's left edge equals the input's.
- ReadyToPost Mark posted (date cleared, submitted), PeriodsGates add-period and add-gate, CalendarList: native error under its input, bottoms equal, no overlap with the next row at 1280 and 390.

## Non-goals

`Inline` stays unchanged; rows in `ChannelSettings.tsx`, `campaigns.tsx`, `feeds.tsx` are not touched unless they hold a Field with an error line (checked, then listed).

## Code review

- greenrack: backend, lang:typescript, react, ui-design (unix, tui left out: no CLI output change)
- social-planner: backend, lang:typescript, react, ui-design (unix, tui left out: no CLI output change)
- decisions: none — markdown only

<!-- panel: repos=greenrack,social-planner,decisions adds=ui,contract reviewers=backend,typescript,react,ui-design,tui,unix,po,architect body-sha=73d2c47adb32 -->
