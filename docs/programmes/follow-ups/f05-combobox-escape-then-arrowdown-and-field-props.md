+++
type = "task"
mode = "afk"
status = "closed"
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

## Resolution

2026-11-24 (greenrack#234). Yes to both, on the web.

- **ArrowDown:** the keydown effect in `useComboboxRoot` returned early while the list was closed. A second listener now runs while it is closed and handles ArrowDown on the input only: `openPopup()`, which highlights the chosen option or the first. Enter, Tab and Escape stay the input's own while closed, so Enter commits nothing and `onOpenChange` does not fire twice. Story `EscapeThenArrowDownReopens`.
- **Field state:** `Combobox.Root` reads the Field once and puts `disabled` and `required` on the context.
  - A disabled Field disables the input, `Combobox.Trigger` and the hidden `name` input, with Select's disabled look.
  - A required Field makes the input `required`, wired to `useNativeValidation` for `Field.Error`.
  - Stories `DisabledInsideField` and `RequiredInsideField`.
- The ticket's premise held only for `disabled`: `Input` and `Textarea` ignore Field `required` too, filed as f10. Native Combobox reads neither, filed as f11.
