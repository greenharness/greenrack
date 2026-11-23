+++
type = "task"
mode = "afk"
status = "open"
blocked_by = []
repos = ["greenrack"]
+++

# A native Combobox inside Field.Root is named by its Field.Label

## Question

`Combobox.native` does not read `Field.Label`, so a native Combobox inside `Field.Root` is named by its value. It is documented in the 7.2.0 meta; the fix is to give the native Field its label text (interface review, combobox-open, 2026-11-20).

## Look at

- `Combobox.native`, `Field.Label`, and the 7.2.0 meta that documents the gap

## Answer looks like

A native Combobox in a `Field.Root` with a `Field.Label` whose accessible name is the label, and the 7.2.0 meta note removed.
