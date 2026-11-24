+++
type = "task"
mode = "afk"
status = "open"
blocked_by = []
repos = ["greenrack"]
+++

# Input and Textarea take Field's required

## Question

`Input` and `Textarea` read Field's `disabled` (`disabled ?? ctx?.disabled`) but only their own `required` prop. A `Field.Root required` shows the required indicator, yet its control is not required, so the browser never refuses an empty submit. The web Combobox reads `ctx.required` since f05 (greenrack#234). Found 2026-11-24 while working f05. Should `Input` and `Textarea` take `required ?? ctx?.required`?

## Look at

- `packages/ui/src/components/Input/Input.tsx` (`effectiveDisabled`, the `required` prop), `Textarea/Textarea.tsx`
- `packages/ui/src/components/Field/Field.tsx` (where `required` enters the context), `Combobox/Combobox.tsx` (how it reads it)

## Answer looks like

A greenrack PR where an `Input` and a `Textarea` inside a `Field.Root required` are required (a story each, `toBeRequired()`), and an explicit `required={false}` still wins, merged on green.
