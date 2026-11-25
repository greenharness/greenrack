+++
type = "task"
mode = "afk"
status = "open"
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
