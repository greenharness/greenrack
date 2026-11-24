+++
type = "task"
mode = "afk"
status = "closed"
blocked_by = []
repos = ["greenrack"]
+++

# A native Combobox follows its Field's disabled and required

## Question

`Combobox.native.tsx` reads no Field state. Inside a disabled `Field.Root`, a native Combobox still opens its sheet, and its required state is not exposed. The web Combobox reads both since f05 (greenrack#234). Found 2026-11-24 while working f05, beside f06, which is about the native label. Should the native field be disabled, opening no sheet, and expose required?

## Look at

- `packages/ui/src/components/Combobox/Combobox.native.tsx` (Root, Input, the sheet open), `packages/ui/test/combobox-native.test.ts`
- `Combobox/Combobox.tsx` (how the web Root reads the Field), f06

## Answer looks like

A greenrack PR where a native Combobox in a disabled Field does not open its sheet and reports itself disabled to accessibility, and a required one is marked required, shown by `combobox-native.test.ts` cases, merged on green; the meta's "native reads neither" note removed.

## Resolution

2026-11-25, greenrack PR. Yes to both. `Combobox.Input` (native) reads the Field context it
already read for `labelText`:

- **Disabled:** the `Pressable` takes `disabled`, `onPress` opens nothing while disabled, the
  accessibility state carries `disabled` beside `expanded`, and the field takes the web's
  `inputWrapperDisabled` look (as `Select.native` takes `triggerDisabled`).
- **Required:** React Native 0.81 has no required accessibility state (`AccessibilityState` has no
  such key, and no `aria-required`), so the label carries it: " (required)", the text the web
  label reads, is appended to whatever names the field (`aria-label`, `labelText`, the shown
  value or the placeholder), except when `labelText` names the field and
  `necessityIndicator="label"`, so it already ends with it.
- **Proof:** two `combobox-native.test.ts` cases: a disabled Field (the `disabled` prop, the
  accessibility state, a press that calls no `onOpenChange`; the enabled case beside it), and a
  required one (icon indicator, `aria-label`, label indicator not doubled but kept for `aria-label` or no label, no Field).
  Both fail on `origin/main` and pass with the change; 8 of 8 pass. No React Native app in this
  repository renders it, so the unit cases are the check, as in f06.
- The meta's "native reads neither" note now says what native does; `registry.json` regenerated.
  Patch changeset `combobox-native-field-state`.
- **Implementation review:** approve-with-changes. Fixed: the suffix was dropped whenever
  `necessityIndicator="label"`, also for a field named by `aria-label` or the placeholder; now
  only when `labelText` names it. 80k tokens, 60 s.
