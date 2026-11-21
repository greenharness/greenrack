---
status: active
branch: feat/theme-tokens-by-mode
repos: [greenrack, application-landscape, homelab, decisions]
adrs: [greenrack ADR-0003 revision (extends, supersedes nothing)]
plan-id: p-01M7ZP0K3FPA6N3H9R8780EM1P
---

# ThemeProvider token values per mode and per contrast, in CSS

## Review panel

👉 **Decide:** the body grew ×1.62 under review (1435 → 2327 words). Approve if keeping the reviewers' edge cases beats a trimmed plan.
📍 greenrack, application-landscape, homelab, decisions · 4 phases · 3 releases · next: Phase 1. Panel: architect, backend, lang:typescript, platform, po, react, tui, ui-design, unix (opus-5-5), codex.
**Changed by review:** the follower is an explicit marker and nested providers are pinned; the server-render proof is a hydrating story; the CLI and the release rehearsal are made exact.
**Verdicts:** round 1: 9 approve-with-changes. Round 2: 9 approve-with-changes, then backend approve on the final body. Codex: approve-with-changes, 3 high applied. 11 carried; words 1435 → 2327 (×1.62); remove 0, merge 0.
📄 Full reviews: [2026-11-21-theme-tokens-per-mode.reviews.md](2026-11-21-theme-tokens-per-mode.reviews.md).

## Picture

```
 today                            after this plan
 -----                            ---------------
 tokens={flat}                    tokens={{...flat, light, dark,
 one rule, values picked in JS             contrast:{light, dark}}}
 [gr][gr] { <JS theme> }          one <style>, in source order:
                                  1 [gr][gr] { flat + JS theme }
 system, no cookie, server:       2 @media (p-c-s: light) { light }
   JS theme 'dark' until mount    3 @media (p-c-s: dark)  { dark }
   light OS paints dark, flips      (2 and 3 only under system)
 prefers-contrast: JS only,       4 @media (prefers-contrast: more)
   after hydration                    [and (p-c-s: x)] { contrast.x }
 app keeps a generator of         server render right on every OS
   hashed variable names          setting; the app's generator goes
                                  ColorModeProvider(tokens) tells its
                                  provider 'system'; islands are pinned
```

The left column is why application-landscape still generates CSS; the
right is the rule a provider emits once its tokens can be keyed by mode.

## Context

Follow-up f107 (`decisions:docs/programmes/follow-ups/f107-application-landscape-theme-onto-override-api.md`),
blocked on [greenrack#214](https://github.com/greenharness/greenrack/issues/214).
`ThemeProvider` `tokens` emits one unconditional rule (`overrideRule.ts`)
with values picked in JS from the rendered theme. `useSystemScheme` answers
`'dark'` until mount, so with a `system` preference and no stored choice
the server render can only carry dark values, and `prefers-contrast` can
only be honoured by a `matchMedia` hook after hydration. application-landscape
therefore overrides the hashed variables from a generated stylesheet
(`scripts/generate-greenrack-theme.mjs` → `app/styles/greenrack-theme.css`,
with a CI staleness step). f101 checked that all four of its palettes pass
`validateTokens` unchanged; the conditions are the only gap.

## Goal

Outcome: no visitor-visible change (0 diffs). The maintainer deletes the generator, its CSS and a CI step; any greenrack consumer gets a correct first paint without a generator.

1. greenrack: `tokens` takes optional `light`, `dark` and
   `contrast: {light, dark}` entries next to the flat groups, and the
   provider emits them under CSS conditions, so a server render under a
   `system` preference paints the right values for the visitor's OS and
   contrast setting before hydration. Released as greenrack 7.5.0
   (additive; `@greenharness/greenrack-tokens` and `-ui` both change).
2. application-landscape: the paper-and-ink palette moves onto that API;
   the generator, `app/styles/greenrack-theme.css`, the `greenrack:theme`
   script and the CI staleness step go away, with 0 colour diffs on first
   paint before hydration.

## Decisions

- **Shape.** `ThemeTokensByMode = ThemeTokens & {light?: ThemeTokens; dark?: ThemeTokens; contrast?: {light?: ThemeTokens; dark?: ThemeTokens}}`,
  in `greenrack-tokens/theme`. Flat groups apply in every mode; a mode
  entry lays over them; `contrast[x]` lays over `x` under
  `prefers-contrast: more`. Mixing is the point (typography stays flat,
  colours per mode). `light`, `dark`, `contrast` are reserved names, not
  groups: a new `splitModes(tokens)` peels them off and each part goes
  through `validateTokens`; a reserved name inside a mode entry (`dark.contrast`, `light.dark`) is dropped with its path; a dropped entry is reported with its path
  (`dark.colors.bg: …`). A flat-only `tokens` behaves exactly as today
  (same rule string — the existing override-rule tests stay green
  untouched).
- **Which values a theme takes.** `light` → flat ⊕ light; `dark` → flat ⊕
  dark; `high-contrast` (the DS's own pinned theme) → flat only, and no
  contrast block: it already is the contrast theme.
- **Knowing "system".** A small `ColorSchemeSourceContext`
  (`components/ThemeProvider/schemeSource.ts`, its own module because
  ColorMode imports ThemeProvider) holds `'system' | 'pinned'`, default
  `'pinned'`. `ColorModeProvider` sets `'system'` when its preference is
  `system`. The follower is the `ThemeProvider` that `ColorModeProvider`
  renders under `applyTheme` (an internal `followsMode` prop) or, with
  `applyTheme={false}`, the nearest one under it; no theme-equality test.
  It emits media blocks unless its theme is `high-contrast`.
  Only that follower reads it, and every
  `ThemeProvider` resets it to `'pinned'` for its children, so a dark
  island nested inside stays dark whatever the OS says. This covers both
  paths: `applyTheme` (default) and `applyTheme={false}` with the app's
  own provider.
- **`ColorModeProvider` gets `tokens`**, forwarded to the `ThemeProvider`
  it renders under `applyTheme`, so the app needs no second provider.
- **Emission order**, one `<style>`, same doubled scope selector
  everywhere, so source order decides: base (flat ⊕ JS theme); then,
  under `system` only, `@media (prefers-color-scheme: light)` and
  `(… dark)` blocks; then contrast: under `system`
  `@media (prefers-contrast: more) and (prefers-color-scheme: x)` for each
  x, else `@media (prefers-contrast: more)` for the JS theme. A block with
  no declarations is left out. The string is a pure function of props and
  context, identical on server and first client render.
- **Nesting.** `EffectiveOverrides` carries the flat set plus the four mode
  sets. A nested provider on theme X takes the outer provider's `X` and
  `contrast.X` values whatever the outer JS-picked theme is. It inherits the outer
  flat colours and shadows only when the outer is pinned to X, and the rest
  inherits. Resolve each applicable inherited state first, then overlay the child's
  validated flat, mode and applicable contrast entries, in that order. Child
  entries win over inherited entries even across buckets; independently merging
  buckets and then overlaying mode on flat is insufficient. Preserve enough state
  to apply this rule through further nesting. Add normal/contrast collision tests
  for a parent's mode-specific color and typography overridden by child flat
  values, including a grandchild and native's normal-mode resolution.
  Every nested provider is pinned (the context reset), so it emits
  its theme's set on its own scope and the outer media blocks never reach it.
- **Native.** Same type. Native takes flat ⊕ the `light`/`dark` entry via an explicit mapping (not `tokens[theme]`: `'high-contrast'` is no key of the type; high-contrast takes flat only, as on web); contrast and
  `system` media do not apply (documented in the prop's JSDoc).
- **Known edge, documented.** A nested provider that follows the mode
  (`theme={useColorMode().theme}`) is pinned like any island, so under
  `system` on a light OS it paints `dark` until hydration. To follow the
  mode, pass tokens to `ColorModeProvider` instead of nesting a provider.
- **Out of scope, said in the docs.** Under `system` on the server render
  the DS's own light theme class is not applied until mount; a colour or
  shadow key the tokens leave out shows the DS dark default on a light OS
  until hydration, and a key given in `dark` but not in `light` keeps its
  dark value on a light OS (the light block only overrides what it
  names). Consumers cover the same colour and shadow keys in both
  modes (application-landscape's coverage guard checks this); full coverage waits on the follow-up. Making the DS's own
  themes follow `system` in CSS is a separate follow-up, filed in Phase 4.

## Phases

- [x] **Phase 1 — greenrack API** (worktree `greenrack-wt-theme-modes`,
      branch above).
  - `packages/tokens/src/theme.ts`: `ThemeTokensByMode`, `splitModes`,
    `validateModeTokens` (validates each part; `DroppedToken` gains an optional `mode` (`'dark'`, `'contrast.light'`) that `describeDropped` prefixes, so `group` stays a real group in the CLI's `problems` JSON, `mockup.ts:236`);
    tests in `packages/tokens/test/theme.test.ts`.
  - `packages/ui/src/components/ThemeProvider/schemeSource.ts` (context);
    `packages/ui/src/components/ThemeProvider/overrides.ts` (`ownTokens`
    keeps mode entries, `mergeOverrides` per mode);
    `packages/ui/src/components/ThemeProvider/overrideRule.ts` keeps `overrideRule` as is and gains a sibling pure `modeRules` for the conditional blocks (reuses `variableFromReference`, `validateTokens`); the provider joins both; `packages/ui/src/components/ThemeProvider/ThemeProvider.tsx`
    reads and resets the context;
    `packages/ui/src/components/ThemeProvider/ThemeProvider.native.tsx`
    picks flat ⊕ mode; `packages/ui/src/components/ThemeProvider/warnDropped.ts`
    prints the path (`dark.colors.bg`) and its dedupe signature includes the mode path, so the same bad value in `light` and `dark` warns twice (test); `packages/ui/src/components/ColorMode/ColorMode.tsx`:
    `tokens` prop, context provider.
  - Tests: `packages/ui/test/override-rule.test.ts` (each block, order,
    empty blocks dropped, flat-only string unchanged, high-contrast);
    `packages/ui/test/theme-tokens.test.ts` (per-mode merge, nested reset; a `theme="dark"` island's rule is identical with the outer theme set to `'dark'` and to `'light'`, under both a pinned and a `system` outer);
    a `ServerRender` story in `ThemeOverrides.stories.tsx` (the storybook browser project, which compiles StyleX; the unit project cannot import ThemeProvider.tsx; same pattern as `Time.stories.tsx:145`): `renderToString` of
    `ColorModeProvider` `defaultPreference="system"` with mode tokens
    contains the media blocks, a pinned preference does not, a nested
    `ThemeProvider` emits no `prefers-color-scheme`, and two renders give
    the same string; then `hydrateRoot` with `onRecoverableError` collecting errors asserts 0, so hydration is proven in greenrack before Phase 2.
  - CLI: `greenrack mockup seed --overrides` reads the same file
    (`packages/cli/src/commands/mockup.ts`, `isTokensShape` +
    `validateTokens`): `isTokensShape` accepts the reserved keys (a
    modes-only file is not read as bare colours); `splitModes` runs before
    `validateTokens`; the seed writes flat ⊕ dark under the exclusive selector
    `:root:not([data-theme="light"]):not([data-theme="high-contrast"])`,
    flat ⊕ light under the light selector, and flat only under high-contrast
    (today one set goes under all three, `mockup.ts:207-211`). A mode entry
    wins over flat for the same key. Never put dark-only declarations on an
    unconditional `:root`. Verify computed typography for a dark-only font-family
    override in dark/default, light and high-contrast seeded HTML; the latter
    two retain their flat value or stock default. `contrast` is not applied: one stderr
    note, exit 0, and the summary names the applied modes. A dropped mode
    entry stays a usage error (exit 2), its `problems` (text and JSON)
    carry `mode`; no colour codes. Tests in
    `packages/cli/test/mockup.test.ts` for each; `packages/cli/README.md`.
  - Decision: ADR-0003 (`theming.overrides`) states the `tokens` shape;
    `docs/adr/0003-theme-overrides-colours-fonts-radii.md` gets a revision
    for the mode entries and the system/contrast emission, and
    `docs/adr/HEADS.md` follows.
  - Changesets: `.changeset/theme-tokens-by-mode.md` (minor for
    `@greenharness/greenrack-tokens`, `@greenharness/greenrack-ui`,
    patch for the CLI).
  - Story: `packages/ui/src/components/ThemeProvider/ThemeOverrides.stories.tsx`
    gets a "by mode" story (states pinned with `emulateMedia` in the Storybook browser project: light, dark, contrast-more, and a key missing from `light`); the `meta.ts` sentence "pass per-mode values when the mode can change" is rewritten (a key present in one mode and absent in the other keeps the base rule's value under `system`); the ADR revision and JSDoc say the same; `packages/ui/src/components/ThemeProvider/ThemeProvider.meta.ts`
    and the JSDoc of `tokens` (both providers) and `ColorModeProvider.tokens`.
- [x] **Phase 2 — prove it in the app before tagging.** In disposable packaging
      state, mirror release.yaml's version stamping to 7.5.0 before `pnpm -r build`
      and `pnpm pack` of tokens and ui. Inspect the packed manifests and their
      rewritten workspace dependency ranges. An application-landscape worktree
      (`application-landscape-wt-f107`, branch `feat/theme-on-override-api`)
      installs the tarballs, using a temporary pnpm override so every tokens
      dependency, including UI's transitive dependency, resolves to the candidate
      tarball. Verify the installed graph and tarball provenance before browser
      checks. Keep packaging-only version edits out of the greenrack PR. Reset app
      manifests, overrides and lockfile (`package.json`, `pnpm-lock.yaml`) to
      the published npm versions in Phase 4.
      This worktree does Phase 4's change. `browser-check` agent, JavaScript disabled, against the
      worktree's server and against `origin/main` built the same way: computed
      values of every colour and shadow variable plus `background-color`/`color`
      of `body`, a card and a primary button on `/` and one admin route, in
      these cells: no cookie × OS light/dark × contrast none/more; `mode`
      cookie light/dark × contrast none/more. Baseline values from `origin/main` are recorded in the PR description. Pass = 0 diffs. Then with JS on, an open Menu popup and a Dialog (portalled; they
      cannot open without JS) compared the same way, and
      the app's fixed seven-cell script and the leak crawl. A diff sends the
      work back to Phase 1 (no tag yet).
- **Phase 3 — greenrack PR, review, merge, release 7.5.0.** worktree-task
  F4/F4b reviews, PR, `merge-when-green`, `tag-release` v7.5.0
  (`packages/tokens/package.json`, `packages/ui/package.json` versions as
  the repo's release flow sets them); check both packages on npm at their
  new versions.
- **Phase 4 — application-landscape PR (f107).**
  - `app/root.tsx`: `ColorModeProvider tokens={landscapeTokens}`; the
    `.greenrack-landscape` wrapper goes when a grep of `app/` for
    `greenrack-landscape` finds no hits outside the removed generated CSS;
    otherwise it stays, with a comment saying why.
  - New `app/styles/landscapeTokens.ts`: the four palettes from the
    generator, typed `ThemeTokensByMode`.
  - Coverage guard `app/styles/landscapeTokens.test.ts`: `light` and `dark`
    carry the same `colors` and `shadows` key set (the keys the generator
    emits today), `contrast.x` keys are a subset of `x`'s, and
    `validateModeTokens` drops nothing. Keys the app never covered keep
    today's behaviour (the DS-system-theme follow-up), so the 0-diff bar holds.
  - Remove `scripts/generate-greenrack-theme.mjs`,
    `app/styles/greenrack-theme.css`, its import, the `greenrack:theme`
    script in `package.json`, the CI staleness step
    (`.forgejo/workflows/ci.yaml` ~l.220), the `greenrack-theme.css` case in
    `.forgejo/scripts/ui-handoff.sh` (l.62) and its row in `ui-handoff.test.ts` (l.134); rewrite `CLAUDE.md` "Theming"
    to the API and the guard.
  - Bump `@greenharness/greenrack-ui`/`-tokens` to 7.5.0's versions
    (`grep -cE 'file:|\.tgz' pnpm-lock.yaml` must give 0 before the PR);
    re-run Phase 2's checks on the final tree; PR, merge; tag the next app version (`vX.Y.Z`)
    (release.yaml builds it and pushes it to Forgejo and ghcr; check that both have the tag);
    in a homelab worktree bump `ghcr.io/fredericrous/application-landscape` in BOTH
    containers (`web` and `yjs`) of the app's Deployment, push, and wait for the Flux
    Kustomization to be Ready and the pod `2/2 Running` on the new image; then the
    JS-disabled check once against production.
  - Rollback: revert that homelab commit (both images back to the previous tag, which
    stays in both registries). Nothing is stored, so no data is at risk; `Recreate`
    means a short outage on deploy and again on revert.
  - decisions: close f107 in
    `docs/programmes/follow-ups/f107-application-landscape-theme-onto-override-api.md`
    with its Resolution, file the DS-system-theme follow-up, line in
    `docs/programmes/follow-ups/map.md` + handoff.

## Verification

Observed on the branch's final tree (`3a415a99`, tree `7a4beff77f1f`), before the push:

- greenrack unit project (tokens + ui tests): input `vitest --project=unit`,
  expected all pass, actual 253/253. CLI `mockup.test.ts`: 124/124. The CLI
  suite's `popover.test.ts` "registry and CLAUDE.md are current" timed out
  at 60 s on the loaded host. `build-registry --check` run alone reports
  "registry: up to date".
- Storybook browser project: `ThemeOverrides.stories.tsx` 6/6, and
  ThemeProvider + ColorMode 24/24. Checks (a)–(c) are in `ServerRender`:
  scheme blocks light then dark, then contrast; no scheme block when
  pinned; the server markup's computed bg and text match the runner's
  scheme before hydrating; 0 recoverable errors in `act()`.
  `WarnsDroppedModeValue` covers the warning that names `dark.colors.bg`.
  Check (d), flat-only rule unchanged: the pre-existing `overrideRule`
  tests pass untouched.
- Typecheck: 0 errors.
- Phase 2, application-landscape on tarballs packed from this tree
  (stamped 7.5.0, ui depends on tokens `^7.5.0`, one tokens copy in the
  graph). Expected 0 diffs against `origin/main`. Actual, with JS disabled
  and the 79 colour and shadow variables plus body, theme node and button
  colours compared: 0 diffs in 8 cells × `/` and `/admin` (leading zeros
  normalised; before that, the only differences were `.07` vs `0.07`). With
  JS on, after hydration: 0 diffs in 4 cells, the open menu included, and 0
  hydration errors. Evidence: `~/.claude/greenbelay/attestations/3a3ff8ce0e9b/`.
- Size: the theme `<style>` is 946 B gzip with no cookie (ceiling 5 KB).
  The `/` HTML is 97,848 B vs 95,207 B on base. CSP: the app sets none, so
  an inline `<style>` is allowed.
- Not yet run, because they belong to later phases: the production
  JS-disabled cells after deploy, and the rollback trigger.

## Decision log

- 2026-11-21 — relais was not used for Phase 1. Two runs ended
  `admission_wait_exhausted`: the host was jammed by other sessions' Rust
  pushes, and nothing was launched. The work was done by hand.
- 2026-11-21 — No `followsMode` prop. The context reset already makes the
  nearest ThemeProvider under ColorModeProvider the only reader of
  `system`. Under `applyTheme={false}`, siblings directly under it all
  follow (react review). This is documented in `schemeSource.ts` and in the
  ColorModeProvider `tokens` JSDoc, and pinned in the `ServerRender` story.
- 2026-11-21 — Under `system` the base rule holds the flat values only
  (ui-design review). With the JS theme's mode in it, a key set flat and
  overridden in `dark` alone kept its dark value on a light OS. Each scheme
  block now lays its mode on the flat values. This is simpler, and right
  for every shape the tokens allow.
- 2026-11-21 — Storybook's vitest browser project has no `emulateMedia`.
  The `ByMode` and `ServerRender` stories check whichever scheme and
  contrast the runner has. `ServerRender` reads the computed values of the
  server markup before hydrating it. Phase 2 measured the full matrix
  against application-landscape.
- 2026-11-21 — `vitest.config.ts` aliases
  `@greenharness/greenrack-tokens/theme` to its source, so the ui unit
  tests exercise the new validators rather than a stale dist.
- 2026-11-21 — The fixed seven-cell script and the leak crawl from the
  greenrack sweep were session scripts, not committed files. Phase 2
  replaced them with a token-by-token comparison of all 79 colour and
  shadow variables on the ThemeProvider node, plus the computed colours of
  body, the theme node, a button and an open menu. It ran in 8 cells × 2
  routes before hydration (JS disabled) and 4 cells after it. The key set
  is unchanged from the sweep, so a leak crawl has nothing new to find.

## Implementation review

- implementation-review: R1 approve-with-changes (4 blocking, 1 high fixed); Delta approve-with-changes, low `tokenValue` rename kept deliberate: its own candidate ruling calls `valueText` fine.
- backend R1 approve-with-changes, all fixed, Delta approve; lang:typescript R1 6 fixed, Delta medium nullable `DroppedToken.group` deliberate: no consumer outside greenrack, null only for new mode entries.
- react R1 2 fixed, Delta low replay flake deliberate (CI runs once); architect R1 4 fixed, Delta approve; unix R1 approve.
- ui-design R1 medium (flat base under system) and low fixed; Delta low (no provider-level base test) deliberate: app SSR base held no mode colour.
- All seats opus-5-5; reviews ran 15–220 s each.

## Non-goals

- The DS's own light/dark theme classes following `system` in CSS (the
  follow-up filed in Phase 4).
- `prefers-contrast` or OS scheme on native.
- Any visual change to application-landscape: 0 diffs is the bar.

## Code review

- greenrack: backend, lang:typescript, react, architect, unix, ui-design (tui left out: `mockup seed --overrides` is a flag on an existing non-interactive command, no interactive surface)
- application-landscape: backend, lang:typescript, react, platform, architect (ui-design left out: 0 colour diffs is the bar)
- homelab: platform (image bump in both containers, Flux wait, rollback)
- decisions: none — markdown only

<!-- panel: repos=greenrack,application-landscape,homelab,decisions adds=contract reviewers=architect,backend,lang:typescript,platform,po,react,tui,ui-design,unix,codex body-sha=a768a4b8a033 -->
