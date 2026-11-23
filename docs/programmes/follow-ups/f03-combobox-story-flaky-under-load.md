+++
type = "task"
mode = "afk"
status = "closed"
blocked_by = []
repos = ["greenrack"]
+++

# The Combobox story that loads on open passes under load

## Question

The Combobox story `OptionsLoadOnOpen` (added in #212) failed in the full pre-push Storybook
suite on 2026-11-21, while landing `fix/list-tabs-semantics` with the machine's load average
near 50. The error was "The component failed to render properly, likely due to a configuration
issue in Storybook". Run alone on the same tree, the Combobox stories pass, 17 of 17, and the
next full run passed. A failure that only shows under load blocks unrelated pushes, and makes
a real Combobox regression look like noise.

What does the story's render depend on that a loaded machine delays: a timer in the story's
loader, a late dynamic import, the play function starting before the first render? Make the
story deterministic.

## Look at

- `packages/ui/src/components/Combobox/Combobox.stories.tsx` (`OptionsLoadOnOpen`: its loader and play)
- `vitest.config.ts` (the storybook project's timeouts) and `.storybook/vitest.setup.ts`
- the failing run's log, if it is still in a land receipt under `.git/worktrees/*/greengate/land/`

## Answer looks like

A reproduction under load (the suite with CPU pinned, or the story repeated N times in
parallel) that fails before the fix, and passes 20 runs in a row after it. The cause is named in
the fix's commit.

## Resolution

2026-11-23. greenrack#223. The story asserted a transient state: the demo
flipped to loaded 50 ms after opening, and the play function waited for
"Loading fruits" with `findByText`. A browser slowed by load misses a 50 ms
window. With the demo's delay forced to 0 the same story fails at that
`findByText` on 2 of 2 runs. The story now holds the load behind a promise
that `beforeEach` creates and the play function releases after it has seen
"Loading fruits"; the visible `LoadOnOpen` keeps its timer.

Evidence: the story passes 20 of 20 runs with 12 busy processes pinning the
CPU (`vitest --project=storybook`, `-t "Options Load On Open"`), and the
Combobox stories pass 17 of 17.

Not proven: the failure this ticket recorded said "The component failed to
render properly", while the reproduction fails with "Unable to find an
element with the text: Loading fruits". They are the same race by mechanism,
not by message, and the original failure was seen once. Reopen this ticket if
the story fails again with a render error.
