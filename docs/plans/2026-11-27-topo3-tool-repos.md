---
canonical: decisions:docs/plans/2026-11-27-topo3-tool-repos.md
phases: [5]
status: done
---

Part of [Move the tool repositories to greentopo 3.0.0](https://github.com/fredericrous/decisions/blob/main/docs/plans/2026-11-27-topo3-tool-repos.md)
(topo-spotter-rename t24).

## Code review

- greenrack: none — CI pin, re-vendored pack and HEADS.md, regenerated hook, one comment, no code

## Implementation review

- approve-with-changes (opus, 90k, 68 s); fixed: prettier ran after pnpm install (this pointer reformatted), greengate run 27 checks passed; low: Phase 5 tick lands with the Resolution.

Pack: sha256 `ef66e76480492ccd93dc6f042efa00142550d97666d8973f262ecb4b91c662e4`, from decisions `57b484bb50c0`, the same in all seven repositories.
