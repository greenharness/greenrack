+++
type = "task"
mode = "afk"
status = "closed"
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

## Resolution

2026-11-24, greenrack PR. `Input` and `Textarea` take `required ?? ctx?.required`, next to the
`disabled ?? ctx?.disabled` they already had, so a `Field.Root required` makes its control
required and the browser refuses an empty submit. An explicit `required` on the control wins,
`required={false}` included. Neither destructures `required` with a default, so f09's lesson (a
`= false` default hides the fallback) does not apply. Patch changeset
`input-textarea-field-required`.

Evidence: a `RequiredInField` story each (a `Field.Root required` with the control, and a second
one whose control sets `required={false}`) asserts `toBeRequired()` and `not.toBeRequired()`.
Both fail on `origin/main` and pass with the change; the 19 stories of Input and Textarea pass.
