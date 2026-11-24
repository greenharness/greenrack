+++
type = "task"
mode = "afk"
status = "closed"
blocked_by = []
repos = ["greenrack"]
+++

# A native Combobox inside Field.Root is named by its Field.Label

## Question

`Combobox.native` does not read `Field.Label`, so a native Combobox inside `Field.Root` is named by its value. It is documented in the 7.2.0 meta; the fix is to give the native Field its label text (interface review, combobox-open, 2026-11-20). Does giving the native Field its label text make the accessible name the label?

## Look at

- `Combobox.native`, `Field.Label`, and the 7.2.0 meta that documents the gap

## Answer looks like

A native Combobox in a `Field.Root` with a `Field.Label` whose accessible name is the label, and the 7.2.0 meta note removed.

## Resolution

2026-11-24. Yes. React Native has no `for`, and `accessibilityLabelledBy` exists on Android only, so the label gives the Field its text instead of an id.

- **Field:** `Field.Label` registers its text with its Root (`registerLabel`, as `Field.Description` registers itself since f04) and the context carries it as `labelText`. The text is read from its children with the shared `textOf`, plus the " (required)" or " (optional)" text when `necessityIndicator="label"`, which is what the web label reads; the aria-hidden " \*" is left out. A label with no text registers nothing.
- **Native Combobox:** `Combobox.Input` takes `aria-label`, else `labelText`, else the shown value, else the placeholder, as its accessibility label, and the shown value is its accessibility value whenever `aria-label` or the label names it.
- **Proof:** `combobox-native.test.ts` cases for a labelled field with and without a value, `aria-label` over the label, and `Field.Label`'s registered text (flattened children, the necessity text, none without text). No React Native app in this repository renders it, so the unit cases are the check.
- The 7.2.0 meta note ("native does not read Field.Label") is gone. `Select.native` has the same gap, filed as f12.
- **Implementation review:** approve-with-changes. Fixed: the test helper's `ctx` parameter renamed `fieldContextOverrides` (names.reveal-intent). Kept: the mocked hook runtime does not re-render `Input` under a real `Field.Root`; a React Native renderer would close that. 81k tokens, 55 s.
