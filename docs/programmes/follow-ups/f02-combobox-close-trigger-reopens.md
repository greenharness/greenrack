+++
type = "task"
mode = "afk"
status = "closed"
blocked_by = []
repos = ["greenrack"]
+++

# The Combobox trigger labelled Close closes the list

## Question

On the web, once a `Combobox` list is open its trigger reads "Close", but clicking it
leaves the list open. The trigger's `onClick` calls `close()` and then focuses the
input, and the input's focus handler (`onInputFocus`) opens the list again. Escape
does close it. Seen 2026-11-21 in happier's follow-up f02 browser check
(`/settings/voice`): a click on "Close" kept `aria-expanded="true"` and, with options
loaded on open, started a second load. Make the trigger close the list, and keep the
input focused so typing still works.

## Look at

- `packages/ui/src/components/Combobox/Combobox.tsx` (`Trigger`'s `onClick`)
- `packages/ui/src/components/Combobox/useComboboxRoot.ts` (`onInputFocus`, `openPopup`,
  the `refocusAfterChooseRef` guard that choosing an option already uses)
- `Combobox.stories.tsx` `OpenChangeFiresOncePerTransition` (the open/close sequence
  a story test can extend)

## Answer looks like

A greenrack PR where a story clicks "Open", then "Close", and the list is closed with
the input still focused (`onOpenChange` reports one open and one close), merged on
green and released.

## Resolution

2026-11-23. A click on the trigger moves focus to it (the input blurs), and the
trigger's `inputRef.current?.focus()` then ran `onInputFocus`, which reopened
the list `close()` had just closed. The refocus now goes through
`refocusInput()` in `useComboboxRoot`, the `refocusAfterChooseRef` guard a
choice already used, so the focus cancels the pending blur close without
opening. Choosing an option calls the same helper.

Evidence: `OpenChangeFiresOncePerTransition` now renders a `Combobox.Trigger`
and ends by clicking Open, then Close: after the blur-close delay the input has
`aria-expanded="false"`, keeps focus, and `onOpenChange` reported `[true,
false]`. Before the fix it fails with `aria-expanded="true"`; after it all 17
Combobox stories pass. Native has its own trigger and is unchanged.
