---
status: active
plan-id: p-01M86XM5GSWZ57AM4PV3WBBQVC
branch: fix/field-errors-everywhere
repos: [greenrack, social-planner, decisions]
adrs: []
---

# f121: greenrack Field errors right in every story, and a row-level error line

## Review panel

📄 Full reviews: `docs/plans/2026-11-24-field-errors-everywhere.reviews.md`

👉 **Decide:** B6 (hanging message unselectable) is left unfixed; and the row line is only partly research-backed, with a 5-person hallway test to settle it. Otherwise approve.
📍 greenrack, social-planner, decisions · 5 phases · 3 PRs · next: Phase 1, finish the 390 audit. Panel: 11 seats on opus, backend re-run.
**Changed by review:** `Field.Row` is a `Cluster` whose context decides row mode (no `'row'` value); one live region, `aria-atomic=false`; messages always prefixed with the label.
**Verdicts:** 11 approve-with-changes; round 2 backend approve-with-changes; 3 carried (name `Field.Row.tsx`/`.native.tsx`, the B4 source files `docs/ai/recipes/*`, `Form.meta.ts`, `.cursorrules`, and DOM-order via `compareDocumentPosition`, the spike's pass test); words 1195 → 1545 (×1.29), every addition fixes a finding; remove 0, merge 0.

## Picture

```
 before: hanging         after: Field.Row
 [Name] [Date] [Move]    [Name] [Date] [Move]
  msg covers next form    Name: Required. Date: Enter a date.
  next form               next form (pushed down, not covered)
```

The picture shows a row of Fields whose errors move from under each input, where a long one overlaps, to one line under the whole row.

## Context

The person (2026-11-24): too many buggy Field-error stories; cover them all; back choices with UX research. They also held f112's social-planner adoption of `errorPlacement="hanging"`: rows stay aligned, but a long native message overlaps what follows (3 lines / 16 px over the next form at 1280; 4–5 lines over Severity/Covers at 390). They want a greenrack way to show a row's errors in one line below the whole row, released, then adopted.

## Audit so far (real Chromium, greenrack main a5a92c2e, 1280×800)

151 stories in scope; about 50 measured before the Storybook I used was torn down by another session. Phase 1 done 2026-11-24: all 144 in-scope stories driven at 1280 and 390 (Dialog, Select, Video, ThemeProvider, ToggleGroup, CheckboxGroup, Textarea and most Combobox/RadioGroup stories cannot show a Field error: no `Field.Error`, no form in their popups). New findings B7–B11 below; the `togglegroup` 2 px root overflow at 390 has no error and is out of scope.

| #   | Story                                                                                                                                                                                        | Finding                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | `field--inline-row-long-message`                                                                                                                                                             | hanging error is `position:absolute`, 3 lines (48 px), covers "Next row" by 24 px and the button below by 8 px                                                               |
| B2  | `field--hanging-native-message`                                                                                                                                                              | native message wraps to 2 lines, covers the next row by 16 px                                                                                                                |
| B3  | `form--*`, login-form, settings-page, `field--native-validation-form-reset`                                                                                                                  | in-flow errors push every control below down by 22 px each                                                                                                                   |
| B4  | login-form, settings-page recipes                                                                                                                                                            | submit is `disabled={!formState.isValid}`: errors only show after blur; the recipe teaches the anti-pattern                                                                  |
| B5  | `input--error`, `textarea--error`, `*--all-variants`                                                                                                                                         | `aria-invalid=true` with no error element and no `aria-describedby`                                                                                                          |
| B6  | hanging error text                                                                                                                                                                           | `pointer-events:none` makes it unselectable                                                                                                                                  |
| B7  | `field--inline-row-*` (3 stories)                                                                                                                                                            | at 390 the row is `Inline` (nowrap): the page scrolls sideways, `scrollWidth` 496 vs 390 (106 px), error shown or not                                                        |
| B8  | `field--hanging-error-side-label`                                                                                                                                                            | at 390 the input and its error span x 152–496, 106 px past the viewport                                                                                                      |
| B9  | `form--server-validation-errors`                                                                                                                                                             | after a failed submit with a server error, `activeElement` is the Register button, not the invalid username input (every other form story focuses the first invalid control) |
| B10 | `combobox--invalid-inside-field`                                                                                                                                                             | the open listbox covers the 18 px error line (error top 80, listbox 200 px tall)                                                                                             |
| B11 | `field--invalid-without-error-describes-nothing`, `input--all-variants`, `textarea--all-variants`; `field--native-validation*`, `form--validation-on-blur`, `form--server-validation-errors` | more stories of the B5 class (aria-invalid, no message) and the B3 class (+22 px)                                                                                            |
| ok  | alert count, `aria-describedby` ids, stale messages, page width, console                                                                                                                     | clean in all ~50 measured; `hanging-error-side-label` x=152 is correct                                                                                                       |

## Row-level error design

New `Field.Row` in `packages/ui/src/components/Field/`, web only:

- Lays children out as `Cluster` (wraps; `Inline` is nowrap and overflows at 390) and provides a `RowContext`. Row mode is decided by the context being present: the public `ErrorPlacement` stays `'below' | 'hanging'`, no `'row'` value. Each `Field.Root` resets `RowContext` for its own children (a Popover form inside a row is not captured).
- **One line under the whole row**, in flow, full row width, wrapping freely, reusing `styles.error` with `marginTop: spacing.xs`; no new raw values. Inputs, labels and the button never move; the row grows only below, so nothing is overlapped.
- Registration: the context holds only stable callbacks (`register(errorId, order)` returning a slot). Each Field's own error span (both `Field.Error` and Root's native `ownError`) portals into its slot in child order, keeping its element and `errorId`; no message is copied into row state, no in-place rewrite. `errorCount` still counts; the `errorId` element exists once. A spike in Phase 2 confirms portals under react-strict-dom; the fallback is a string message in row state keyed by `errorId`, set only on change.
- Announcing: the line's wrapper is the only live region, `role="alert"` with `aria-atomic="false"`, mounted empty from first render; the spans carry no role, so a second error announces only itself. Submit focuses the first invalid control as the primary cue. Each erring control keeps `aria-invalid` and its invalid border.
- Every message is prefixed by the field's label plain text (no necessity suffix; `errorLabel` prop for JSX labels; falls back to `aria-label`): "Date: Enter a date." Always, even for one error, so the text never changes when a second field errs (WCAG 3.3.1). Joined without doubling a full stop.
- React Native: `FieldRow.native.tsx` renders a wrapping `Cluster` and provides no `RowContext`; Fields keep `below`.
- `errorPlacement="hanging"` stays for a single short line. Phase 2 counts its uses across the fleet; with no consumer it is marked `@deprecated` in the release and removed in the next major.

Research (cited per choice; the person asked for this):
(a) grouping under the row: **partially unbacked** (NN/g error-message guidelines and Strohmeier-type eye tracking, JEMR 9(5):23, favour a message next to its field; GOV.UK groups only within one question): settle with a five-person hallway test at 390 px, hanging vs Field.Row, time-to-fix and wrong-field clicks; the field-name prefix is the mitigation. (b) prefix: WCAG 3.3.1. (c) in-flow growth over reserve: overlap fails WCAG 1.4.10 and 1.4.4; CLS ignores shifts within 500 ms of input (web.dev/articles/cls). (d) never disable submit: GOV.UK button guidance, Roselli 2024, Smashing 2021. (e) one live region mounted empty: MDN live regions, WAI-ARIA `alert` implies `aria-atomic`.

## Fixes

- B1/B2: the two stories become `Field.Row` stories and assert zero overlap; `hanging` docs keep the single-short-line limit.
- B3: keep in-flow growth (backed by (c)); a play test asserts the error line overlaps nothing and the control above does not move; document the shift. No reserve by default.
- B4: login-form and settings-page recipes, plus CLAUDE.md's Form Composition Pattern and Login Form exemplar: submit never disabled by validity; first submit validates and focuses the first invalid control.
- B5: the `Input`/`Textarea` error stories sit in `Field.Root invalid` with `Field.Error`, or are titled "control only".
- B7/B8 (found by the 390 pass): the `hanging` inline-row stories stay on `Inline` (one field and a button) and are guarded by a no-horizontal-overflow assertion, measured 390 = 390; the row cases are `Field.Row` stories (a `Cluster`, which wraps); `hanging-error-side-label` is fixed at its cause (the content column must shrink: `minWidth: 0` on the story's row and the input), with a no-horizontal-overflow play test at 390.
- B9: Form's server-error path moves focus to the first invalid control (`setFocus` on the first errored name), tested.
- B10: deliberate, not fixed: a listbox that is open covers the line beneath the input for as long as it is open, as a native select's popup does; the message returns on close and stays in `aria-describedby`. Revisit if the hallway test says otherwise.
- B6: not fixed, by decision: `pointer-events:none` keeps clicks on the control under a hanging message; `Field.Row` messages are in flow and selectable. Raised to the person here.
- Meta and docs: rewrite `whenNotToUse` (today names `hanging` for rows), add `Row` to `anatomy.optional`, replace the padding-plus-hanging example with a `Field.Row` one, cut the description's overlap paragraph. Run `pnpm greenrack:docs` (regenerates `packages/cli/registry.json` and the CLAUDE.md docs) and `greengate agents-md`; stage both.

## Tests

Each Field error story gets a play test that fails on the bug it guards: one `role=alert` per message, every `aria-describedby` id resolves to exactly one element, error rect does not intersect the next sibling, control top unchanged when an error appears in a row, message cleared after a valid value. Tests select by role and name. Viewport: this repository has no story viewport parameter, so 390 is a phone-wide frame (`sizes.panelSm`) with a no-horizontal-overflow assertion, plus a real-browser check at 1280 and 390; 200 % text is carried. `Field.Row` tests: alert count 1 for two erring fields; DOM-order messages; single error in a multi-field row is prefixed; `aria-label`-only field; native `ownError` in a row; Popover form inside a row; a second error joins without rewriting the first. Carried, not added: a sibling-re-render count, a React Native render test (no RN harness here), 200 % text.

## Non-goals

No change to `Form` validation modes or the `below` default; no reserve space by default.

## Code review

- greenrack: react, ui-design, lang:typescript
- social-planner: react, ui-design, lang:typescript
- decisions: none — markdown only

## Phases

### Phase 1: worktree and full audit

`greenbelay board --repo greenrack`; `worktree-task` worktree (`fix/field-errors-everywhere`), commit this plan as `docs/plans/2026-11-24-field-error-placement.md` (updated), `pnpm install`, own Storybook on a free port (never another session's). Finish the audit over `packages/ui/src/components/Field/Field.stories.tsx` and every other error story with the `browser-check` agent at 1280 and 390, drive popups and dialogs; add each extra bug to the table and the fixes. Re-run `/plan-review` as a delta if it adds more than two bugs.

### Phase 2: implement

`packages/ui/src/components/Field/Field.tsx`, `packages/ui/src/components/Field/FieldContext.ts`, `packages/ui/src/components/Field/styles.css.ts`, `packages/ui/src/components/Field/Field.stories.tsx`, `packages/ui/src/components/Field/Field.meta.ts`: `Field.Row`, fixes B1–B6, tests, docs. Gates: `pnpm -r typecheck lint test`, `node packages/cli/scripts/build-registry.mjs --check --check-docs` (the CI step), Storybook tests, `greenrack doctor`; browser check of the row stories at 1280, 390 and 200 %; code review; PR, merge on green.

### Phase 3: release

Re-check `greenbelay board --repo greenrack` and the latest tag (v7.9.0 at plan time), then release the next minor (7.10.0) via `tag-release` (`packages/ui/package.json` reads 0.34.5; the tag sets the version). Read the Release run's `conclusion`, then `npm view` all seven `@greenharness/greenrack-*` packages at 7.10.0. A part-way publish is resumed with the workflow's dispatch, never a re-tag; a broken release is fixed by 7.10.1.

### Phase 4: adopt in social-planner

On `feat/hanging-field-errors` rebased on main: bump `@greenharness/greenrack-ui`, `-tokens`, `-eslint-config`, `-eslint-plugin` together in `package.json`, lockfile committed; in `app/components/editorial/ReadyToPost.tsx`, `app/components/editorial/PeriodsGates.tsx`, `app/components/editorial/CalendarList.tsx` replace `HangingRow` plus `Inline align="end"` with `Field.Row`, drop the `hanging` props, and delete `app/components/editorial/HangingRow.tsx` (it exists only on this branch) once no import remains. Browser check on the production build at 1280, 390 and 200 % text: input and button bottoms differ 0 px; each row's error line starts at or below the row's bottom edge, overlaps nothing, names its field, one `role=alert` per row; nothing lifts. PR, merge, deploy-observe. Rollback: revert the PR and redeploy (UI only); a greenrack defect gets the next patch, never a moved tag.

### Phase 5: close

Close f121 and f112 (`docs/programmes/follow-ups/map.md` in decisions). After the deploy, re-run the four-row check on production at 1280 and 390: overlap above 0 px, a row whose alert count is not 1, or an unresolved `aria-describedby` reverts the social-planner PR and reopens f121.

## Verification

Phase 1 and 2 observed 2026-11-24 (Phases 3 to 5 pending: release, adoption, close).

- **Audit (Phase 1):** 144 stories driven in Chromium at 1280 and 390 (Dialog, Select, Video, ThemeProvider, ToggleGroup, CheckboxGroup, Textarea and most Combobox/RadioGroup stories cannot show a Field error). Findings B1 to B11 above.
- **Storybook tests (Chromium, vitest):** full suite 695 of 695 on the first implementation; after the review fixes `Field`, `Form`, `Popover`, `Input` and `Textarea` 91 of 91 (`Field` alone 33 of 33). ToggleGroup and VirtualList failed once under a host load average of 300 and passed on rerun, unrelated to this change.
- **Real browser (browser-check, tree `a2efcdec`):** every `Field.Row` story, at 1280 and 390: `scrollWidth` equals `innerWidth` (390); the row's error line starts 4 px under the controls and overlaps the next row by 0 px; one `role=alert` with two spans for two errors; every `aria-describedby` id resolves to exactly one element holding "Date: Enter a date."; the 360 px frame wraps a 3-line message (54 px) and covers nothing; the login form (`form--default`, `recipes--login-form`) submits empty with the button enabled, two messages, focus on Username.
- **Found only by the browser:** a second refused submit in `form--server-validation-errors` left focus on the button (the first fix focused only new errors). Fixed in `dccc613a` (focus each refusal, once per submit); the story now asserts it.
- **Not done, carried:** VoiceOver and NVDA announce check; the five-person hallway test of (a); a sibling-re-render count test, a React Native render test (no RN harness in this repo) and a 200 % text pass; a development warning for a Field in a row that nothing names.
- **Deliberate:** B6 (hanging message unselectable) and B10 (an open Combobox listbox covers its error line). The hanging stories stay on `Inline`, one field and a button, and fit at 390.

## Deviations from the plan

- The files are `FieldRow.tsx`, `FieldRow.native.tsx` and `FieldRowTypes.ts` (not `Field.Row.native.tsx`).
- No story `viewport` parameter exists here, so 390 is tested by a phone-wide frame (`sizes.panelSm`) with an overflow assertion, and checked in a real browser at 390.
- The name prefix falls back to the control's `aria-label` by reading the DOM, because the Field cannot see its control's props.
- The Delta plan-review of B7 to B11 was folded into the implementation review.

<!-- panel: repos=greenrack,social-planner,decisions adds=screen,contract reviewers=ux-research,game-ux,tui,typescript,backend,ui-design,po,unix,platform,react,architect,po body-sha=90dd7e9ee28f -->
