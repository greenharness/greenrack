+++
type = "task"
mode = "afk"
status = "open"
blocked_by = []
repos = ["greenrack"]
+++

# A native Select inside Field.Root is named by its Field.Label

## Question

`Select.native.tsx` names its trigger by `aria-label` only (`accessibilityLabel={ariaLabel}`), so a native Select inside `Field.Root` has no name from its `Field.Label`. Since f06 the Field context carries the label's text (`labelText`), which the native Combobox reads. Found 2026-11-24 while working f06. Should the native Select trigger take `aria-label`, else `labelText`, with its shown value as the accessibility value?

## Look at

- `packages/ui/src/components/Select/Select.native.tsx` (the trigger's `accessibilityLabel`)
- `packages/ui/src/components/Combobox/Combobox.native.tsx` (`Input`, how it reads `labelText`), `Field/FieldContext.ts`

## Answer looks like

A greenrack PR where a native Select in a `Field.Root` with a `Field.Label` has the label as its accessibility label and the chosen item as its accessibility value, shown by a unit case like `combobox-native.test.ts`, merged on green.
