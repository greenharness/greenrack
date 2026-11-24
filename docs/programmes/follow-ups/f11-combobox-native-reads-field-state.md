+++
type = "task"
mode = "afk"
status = "open"
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
