+++
type = "task"
mode = "afk"
status = "closed"
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

## Resolution

Yes: each binds to `ctx.field` when its own value prop is unset (`checked` for `Checkbox`
and `Switch`, `value` for `Slider`), through one hook, `useFieldBinding` in
`FieldContext.ts`. A bound control shows the field's value, writes each change as a plain
boolean or number (never the event: the native `Checkbox`'s synthesized event has no
`target.type`, so react-hook-form would read its `value`), marks the field touched on blur
and puts the field's `ref` on its focusable element (the hidden input, the Slider thumb), so
a refused submit focuses it. On React Native there is no blur to leave: a press of
`Checkbox` or `Switch`, the end of a Slider drag and an accessibility step mark it touched.

The binding is keyed on the value prop alone, not on `onChange` too. Unlike `Input`, whose
`onChange` replaces the field's (so an `Input` given one inside a Form shows the field and
never sets it), a bound control sets the field and then calls its own `onChange` /
`onCheckedChange` / `onValueChange`: a callback for a side effect does not unbind it. Keep it
that way; pass the value prop to leave the field alone.

While bound, `defaultChecked` and `defaultValue` are unused, except that a `Slider` whose
field holds no number shows `defaultValue ?? min` while submitting nothing: the meta and the
prop docs say to give the field a default. No story, recipe or consumer in this repository
put one of the three inside a `Form`'s `Field.Root name`, so nothing rendered changes.

The Form story "Checkbox, Switch and Slider bind" submits, sees the three schema errors,
ticks the checkbox, turns on the switch, presses End on the slider, sees the errors clear and
submits `{terms: true, updates: true, volume: 100}`. It fails with main's three components
and passes here; the 73 stories of Form, Field, Checkbox, Switch and Slider pass. Three
native unit cases cover the press, the step, the own callbacks and the value-prop opt-out.
