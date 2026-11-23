+++
type = "task"
mode = "afk"
status = "open"
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
