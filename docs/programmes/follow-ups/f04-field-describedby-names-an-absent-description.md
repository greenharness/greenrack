+++
type = "task"
mode = "afk"
status = "closed"
blocked_by = []
repos = ["greenrack"]
+++

# The Field's aria-describedby names a Description that is not mounted

## Question

The Field `aria-describedby` string is copied in `Select.Trigger`, `Combobox.Input` and `useFieldGroupLabelling`, and always names `descriptionId` even with no `Field.Description` mounted: a dangling IDREF. Found 2026-11-20 in the interface review of combobox-open. Does one helper in `FieldContext` that adds the id only when a Description is registered fix all three?

## Look at

- `packages/ui/src/components/Field/` (`FieldContext`), `Select.Trigger`, `Combobox.Input`, `useFieldGroupLabelling`

## Answer looks like

One helper used by the three call sites, and a story or test with a Field that has no Description, whose control carries no `aria-describedby` pointing at a missing id.

## Resolution

2026-11-23. Yes, and the fix is wider than the three named sites: `Input`,
`Textarea`, `ColorInput` and `TagGroup` copied the same string, and the error
half dangled too (an invalid Field with no `Field.Error` named an error id that
nothing rendered). `Field.Description` now registers with its Root as
`Field.Error` already did, and each Root computes one `describedBy` on the
context: the description id while a Description is mounted, the error id
while an error line shows (a mounted Error, or the native message the Root
renders itself). All seven call sites and `useFieldGroupLabelling` read it, and
it is `undefined` when neither is mounted. Patch changeset
`field-describedby-present-only`.

Evidence: three Field stories (`WithoutDescriptionDescribesNothing`,
`InvalidWithoutErrorDescribesNothing` over an Input, a Textarea, a Select
trigger, a Combobox input and a RadioGroup; `DescribedByFollowsMountedParts`,
where unmounting the Description drops its id). On the old code all three
fail; with the fix the 23 Field stories and 69 stories of the other affected
components pass. Typecheck (web and native) passes.

Deliberate: the Description registers in a layout effect, as `Field.Error`
already does, so server-rendered HTML names the description id only after
hydration; the first client render matches the server, so hydration does not
mismatch. Worked by hand, not through relais (a small fix).
