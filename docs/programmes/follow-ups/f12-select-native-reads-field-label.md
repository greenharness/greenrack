+++
type = "task"
mode = "afk"
status = "closed"
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

## Resolution

2026-11-25, greenrack PR. Yes. `Select.Trigger` (native) reads the Field context as
`Combobox.Input` does since f06:

- **Name:** `accessibilityLabel` is `aria-label`, else the enclosing `Field.Label`'s `labelText`
  (with its necessity text). With neither, it stays unset, so the trigger still reads its
  children (the shown value or the placeholder), as before.
- **Value:** when `aria-label` or `labelText` names the trigger, the chosen item's label (else the
  raw value) is its `accessibilityValue`; nothing before a choice.
- **Import:** `accessibilityFocus` is imported by its `.native` path, as `Combobox.native` does, so
  the unit project (no `.native` resolution) can load the file.
- **Proof:** `select-native.test.ts`, 4 cases (aria-label outside a Field, Field.Label with
  aria-label first, no value before a choice, raw value fallback). All 4 fail on `origin/main`'s
  trigger and pass with the change. No React Native app in this session: the check is the unit
  test, the native typecheck and `check-native-graph`.
- **Not done:** neither Select reads the Field's `disabled` or `required` (the web one reads only
  the control id, `describedBy` and `invalid`); left to its own ticket.
