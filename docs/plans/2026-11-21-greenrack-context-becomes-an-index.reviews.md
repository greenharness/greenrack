# Full reviews: Greenrack context becomes an index

## Full reviews (reference)

- architect: round 1 approve-with-changes (4 findings; 53k tokens, 56 s); round 2 resolved all four (57k, 13 s). Carried: SessionStart fires again on resume and compact, so `--session-start` prints again even when the marker exists; add a case to `test_entry.py`.
- backend: round 1 approve-with-changes (9 findings; 56k, 60 s); round 2 approve-with-changes (3 new high, all fixed; 75k, 58 s); final delta approve (67k, 13 s). Carried: a backoff after repeated `npx` failures; the Outcome baseline read from the saved transcripts; the 15 s timeout set on the settings entries.
- lang:python: round 1 approve-with-changes (5 findings, one blocking; 41k, 60 s); round 2 resolved all five (47k, 17 s). Carried: confirm the `source` values SessionStart sends on the Phase 4 probe.
- lang:typescript: round 1 approve-with-changes (5 findings; 62k, 52 s); round 2 approve (69k, 23 s). Carried: the terminal check for the non-consumer line belongs in `bin.ts` on `process.stderr.isTTY`; build the worst-case doctor fixture from every doctor finding; the Phase 3 check greps for the saved-to-file marker.
- po: round 1 approve-with-changes (4 findings; 49k, 38 s); round 2 approve (55k, 15 s). Finding 4 was rejected and the rejection holds.
- tui: round 1 approve-with-changes (7 findings; 25k, 22 s); round 2 resolved all seven (36k, 16 s). Carried: the marker is written before a repo's own hook runs, so a failing repo hook leaves no index.
- unix: round 1 approve-with-changes (5 findings; 53k, 45 s); round 2 approve (58k, 17 s). Carried: the resume and compact case, as above.
- codex: not run. It would send the plan, repository names and local paths to an outside service, which was not asked for in this session. The skill's step 6b can be run by hand.
