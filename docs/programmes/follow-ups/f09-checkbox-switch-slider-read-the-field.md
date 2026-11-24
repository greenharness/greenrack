+++
type = "task"
mode = "afk"
status = "closed"
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

## Resolution

2026-11-24, greenrack PR. They adopt the Field the way `Input` does. On the web, `Checkbox` and
`Switch` put the Field's `controlId`, `describedBy` and `invalid` on their hidden input, so
`Field.Label`'s `for` names it and clicking the label toggles it. The `Slider` thumb is a
`role="slider"` div, which is not labelable: it takes `aria-labelledby` from the Field's
`labelId` while a `Field.Label` is mounted (its `labelText` is set), after its own children
label and `aria-label`. Clicking the label does not focus the thumb. All three take the Field's
`disabled` when their own is unset (the `disabled = false` default went, or the Field's would
never apply). On React Native, `Field.Label`'s text (`labelText`, from f06) is the
accessibility label after `aria-label` (and, for `Slider`, its string children).

Evidence: an `InField` story per control (`Field.Root invalid` with a Label, a Description and
an Error, and a disabled Field) asserts the Label's accessible name, the description plus the
error as the accessible description, and `aria-invalid="true"`. The three fail on `origin/main`
and pass with the change; the 53 stories of Checkbox, Switch, Slider and Field pass. Four unit
cases in `test/field-controls-native.test.ts` cover the native names and `disabled`.

A `Checkbox` or `Switch` with children inside a Field is named by both labels (its own
wrapping label and `Field.Label`'s `for`); the metas say to give it no children there. In
happier, duro-app, application-landscape and social-planner, the seven files that hold both a
`Field.Root` and one of these controls have the control outside the Field, so no name
changes.

The preview review found that the Storybook Controls did not drive these stories. Two causes. The
stories never wrote a click back to their `checked` / `value` arg; they now do (`useArgs`). And
`Switch` itself was out of step: a label click ticked its hidden input but left the track and
`aria-checked` behind, and a track click wrote `input.checked` past React. Its hidden input, and
Checkbox's, now always shows the control's state. `Switch/In Field` and `Switch/Controlled
Ignored` fail on the old Switch.

Not done here: none of the three reads `ctx.field`, so inside a `Form` a
`Field.Root name` does not bind them. Filed as f14.
