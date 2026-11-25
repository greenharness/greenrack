+++
type = "task"
mode = "afk"
status = "closed"
blocked_by = []
repos = ["greenrack"]
+++

# Select follows its Field's disabled and required

## Question

Neither Select reads the Field's `disabled` or `required`. The web `Select.Trigger` takes only the Field's control id, `describedBy` and `invalid`. The native trigger, since f12, takes only `labelText`. Inside a disabled `Field.Root` a Select still opens, and a required one does not say so. Combobox reads both on the web (f05) and on native (f11). Found 2026-11-25 while working f12. Should Select take the Field's `disabled` (Root's `disabled ?? field.disabled`), and expose required: `aria-required` on the web, and the " (required)" label suffix on native as f11 does?

## Look at

- `packages/ui/src/components/Select/Select.tsx` (Trigger, the hidden name input), `useSelectRoot.ts`, `Select.native.tsx` (Root, Trigger)
- `Combobox/Combobox.tsx` and `Combobox.native.tsx` (how f05 and f11 read the Field), `packages/ui/test/select-native.test.ts`

## Answer looks like

A greenrack PR where a Select in a disabled Field does not open and reports itself disabled, and a required one is announced as required on web and native, shown by a story or unit case per platform, merged on green.

## Resolution

Yes, on both platforms, as `Combobox` does (f05, f11). `Select.Root`'s `disabled` now
defaults to the Field's (`disabled ?? field.disabled`), so an explicit `disabled={false}` on
the Root still wins inside a disabled Field. A disabled web Select's trigger is a disabled
button that does not open, and a `name`d one disables its hidden input, so it posts no value.

On the web a required Field makes the trigger `aria-required` (valid on `role="combobox"`).
React Native has no required state, so the native trigger adds " (required)" to its
accessibility label unless the Field.Label's text already carries it
(`necessityIndicator="label"`), the native Combobox's rule. An unnamed native trigger (no
`aria-label`, no Field.Label) still reads its children and carries no suffix: Combobox's
fallback to the shown value does not carry over, since a Select trigger's children are free
content. Accepted gap: put a Field.Label on a required Select.

The stories `DisabledInsideField` (does not open, hidden input disabled, Root's
`disabled={false}` wins) and `RequiredInsideField` (`toBeRequired()`, still enabled), and two
native unit cases in `select-native.test.ts` (disabled and its override; required with
`aria-label`, with `necessityIndicator="label"`, and unnamed), fail with main's Select and
pass here.
