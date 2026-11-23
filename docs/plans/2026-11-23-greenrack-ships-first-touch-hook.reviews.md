# Full reviews: Greenrack ships its own first-touch hook

## Full reviews (reference)

- architect (sh design): round 1 approve-with-changes (blocking: ADR-0075, settled by you; 38k, 43 s); round 2 approve-with-changes (ADR number 0080 taken; absent read from an exit code; 44k, 14 s), applied.
- po (sh design): round 1 approve-with-changes (52k, 47 s); round 2 approve (57k, 12 s). Carried: the new ADR is not in `adrs:` yet.
- tui (sh design): round 1 approve-with-changes (26k, 27 s); round 2 approve-with-changes, no body change (32k, 9 s). Carried: no Verification row for the 80-column rule.
- unix (sh design): round 1 approve-with-changes (61k, 72 s); round 2 approve-with-changes (absent read from an exit code, applied as JSON status; 70k, 24 s).
- backend: sh design round 1, round 2 and delta (approve; 29k, 41k, 48k). Rust rewrite: approve-with-changes (blocking: panel marker; high: Phase 3 before publication; 58k, 35 s), then approve (63k, 24 s). Carried: keep the binary-to-CLI contract fixed across 7.x, or have `[[doctor]]` report `outdated`.
- lang:typescript: sh design rounds 1 and 2 (63k, 67k). Rust rewrite: approve-with-changes (sha256 vs a newer release; a running exe on Windows; 82k, 53 s), then approve (89k, 19 s). Carried: a different protocol exits 1, a different release with the same protocol stays present.
- lang:rust (Rust rewrite): approve-with-changes (tree kill, exit 0 on panic, MAX_PATH, reclaim race, the test map, a 1 MB event; 29k, 49 s), then approve (34k, 17 s). Carried: a contract test that `--protocol` answers without reading stdin.
- platform (Rust rewrite): approve-with-changes (publish order, versions and resumes, dry run, arm64 musl, cargo cache; 60k, 71 s), then approve (67k, 17 s).
- codex: not run. It would send the plan and local paths to an outside service, which was not asked for in this session.
