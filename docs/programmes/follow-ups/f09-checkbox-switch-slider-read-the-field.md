+++
type = "task"
mode = "afk"
status = "open"
blocked_by = []
repos = ["greenrack"]
+++

# Checkbox, Switch and Slider read their Field

## Question

`Checkbox`, `Switch` and `Slider` never read the Field context (no `useFieldContext`). Inside a `Field.Root` they take no `controlId`, no `describedBy` and no `invalid` from it, so `Field.Label` points `for` at nothing and the Field's description and error do not reach them. Found 2026-11-23 while working f04. Should they adopt the Field context the way `Input` does, through `ctx.describedBy` (greenrack#231)?

## Look at

- `packages/ui/src/components/Checkbox/`, `Switch/`, `Slider/`
- `packages/ui/src/components/Input/Input.tsx` (how a control reads `controlId`, `describedBy` and `invalid`)
- `packages/ui/src/components/Field/FieldContext.ts`

## Answer looks like

Either a greenrack PR where each of the three, inside a `Field.Root` with a Label, Description and Error, has the Label's accessible name, the Field's description and `aria-invalid`, shown by a story per control, merged on green. Or a recorded reason that a control is not meant to sit in a Field (it carries its own label), with the docs saying so.
