# Reviews: ThemeProvider token values per mode and per contrast

All seats ran on opus-5-5. Round 1 used 26–88k tokens and 15–112 s per seat.

- architect: R1 approve-with-changes. Accepted: adrs, sibling `modeRules`. Rejected: a layer list (four fixed conditions; a fifth needs an ADR anyway), lockfile (a duplicate of platform), native device check (ADR caveat). R2: a high on the follower marker, accepted; homelab, accepted.
- backend: R1 approve-with-changes. Seats, observable checks, size/CSP ceiling and the picture line were all accepted. R2: Verification path + escapes (high, accepted), island sentence, homelab. Final: approve. Carried: (d) lives in `override-rule.test.ts`; the CLI ships as 7.5.0 whatever its changeset says.
- lang:typescript: R1 approve-with-changes. ServerRender story, CLI `splitModes`, `DroppedToken.mode` and native mapping were accepted; code-review seats rejected as a duplicate. R2: carried a direct-child island test and a byte-identical join.
- platform: R1 approve-with-changes. Deploy steps, rollback, lockfile grep and ui-handoff refs were accepted. R2: escapes accepted. Carried: the app sets no CSP, so the check always passes.
- po: R1 approve-with-changes. Outcome line, rollback and baseline were accepted. Dropping CLI/native scope was rejected (ADR-0003 parity); po withdrew it in R2. Carried: Phase 4 waits on the npm check; grep for pinned islands.
- react: R1 approve-with-changes. Guard on key-set symmetry, nesting, context and wrapper grep were accepted. R2: dropping the same-theme clause (high) and the context type, accepted.
- tui: R1 approve-with-changes. Warn dedupe by mode and the CLI summary were accepted; grouped warnings rejected (valid palettes warn nothing). Carried: guard failure text `mode.group.key missing`; size numbers in the PR.
- ui-design: R1 approve-with-changes. meta.ts rewrite with emulateMedia states, the dark-only key note, reserved names and portalled surfaces with JS on were accepted. The keys subpath was moot. R2: carried a JSDoc note.
- unix: R1 approve-with-changes. CLI exit codes, stderr note, `mode` field and precedence were accepted. R2: escapes.
- codex: approve-with-changes. Cross-bucket child precedence (high), exclusive dark selector in the CLI (high) and release-stamped tarball rehearsal (high) were applied. Carried: keep the generator's `keepDefault` allowlist plus a `GROUP_KEYS` classification in the app guard.
