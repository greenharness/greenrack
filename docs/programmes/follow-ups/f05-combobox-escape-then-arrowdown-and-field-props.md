+++
type = "task"
mode = "afk"
status = "open"
blocked_by = []
repos = ["greenrack"]
+++

# A web Combobox reopens on ArrowDown after Escape and reads Field's disabled and required

## Question

After Escape on the web Combobox the input keeps focus but ArrowDown does not reopen the list (the key handler runs only while open), and `Field` `disabled` and `required` do not reach `Combobox.Input` the way they reach `Input`. Both predate the combobox-open work (interface review, 2026-11-20). Should the closed input open on ArrowDown, and take Field's state the way `Input` does?

## Look at

- `packages/ui/src/components/Combobox/` (the input's key handler), `Input` for how it reads Field state

## Answer looks like

A story where Escape then ArrowDown opens the list, and one where a disabled and a required Field produce a disabled and a required Combobox input.
