+++
type = "task"
mode = "afk"
status = "open"
blocked_by = []
repos = ["greenrack"]
+++

# Checkbox, Switch and Slider bind to their Form field

## Question

Inside a `Form`, `Field.Root name="..."` hands its control `ctx.field` (value, onChange,
onBlur, ref, name) and `Input` binds to it. `Checkbox`, `Switch` and `Slider` read the Field
since f09 (id, description, error, invalid, disabled) but not `ctx.field`, so a boolean or a
number in the schema is never set by them and a Field error never clears from them. Found
2026-11-24 while working f09. Should each bind to `ctx.field` when its own value props are
unset (`checked`/`onChange` for Checkbox, `checked`/`onCheckedChange` for Switch,
`value`/`onValueChange` for Slider), with `onBlur` marking it touched?

## Look at

- `packages/ui/src/components/Input/Input.tsx` (the `fieldCtx` fallbacks)
- `packages/ui/src/components/Checkbox/`, `Switch/`, `Slider/`
- `packages/ui/src/components/Form/Form.stories.tsx`

## Answer looks like

A greenrack PR where a `Form` with a boolean and a number in its schema, holding a Checkbox,
a Switch and a Slider each in a `Field.Root name`, submits the values they were set to and
shows and clears their errors, shown by a story, merged on green. Or a recorded reason they
stay unbound, with the docs saying how to bind them by hand.
