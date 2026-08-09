# 02 — Case importer: seven CSVs to cases.json

Status: ready-for-human

## What to build

A Node script turning `data/source/*.csv` into `data/cases.json`. This is the data model, and it is subtler than it looks. The spikes in `scripts/spike*.mjs` established all of the following and every point is load-bearing.

**Sheet shape.** Three junk rows, header on row 4: `COLL set | Images | 3x3 algorithm | OH algorithm | Progress`. Group labels (`Pi3: Lines`) appear only on the first row of a group; carry forward. Multi-line alg cells hold alternatives, one per line. The `Images` column is empty in every export. Ignore the OH column entirely. Filenames map to sets: as=AS, s=S, pi=Pi, h=H, l=L, u=U, t=T.

**Text normalisation before parsing.** Curly apostrophes to straight; strip zero-width characters; unwrap the bracketed AUF into real moves — it is part of the algorithm, not decoration. Drop trailing fingertrick-variant fragments introduced by a slash. Known bad rows go in a committed `data/fixes.json` patch layer keyed by set, group and row, applied before parsing, with every fix logged on each run.

**Case identity.** Applying the inverse of an algorithm to a solved cube gives the state that algorithm solves. Three corrections are required before that state can serve as identity:

1. **Rotation normalisation.** Algorithms containing cube rotations end in a rotated frame. Detect the net rotation from the CENTERS orbit and apply the correcting rotation. Without this, every row containing a rotation looks like a distinct case.
2. **AUF canonicalisation.** The sheet omits the trailing AUF. Same-row alternatives reconcile under a post-AUF only — verified as U2, U-prime, or none, and never a pre-AUF. The canonical id is the smallest serialisation across the four U rotations of the state.
3. **Per-algorithm AUF offset.** Store, for each algorithm, which of the four rotations maps its state onto the canonical representative. Issue 07 needs this to display a correct algorithm for a randomly served orientation.

**Validation.** For every case: F2L pieces are identity and all four last-layer edges have orientation zero. For every row: all alternatives must resolve to the same canonical id. Anything failing goes on a reject list printed with set, group, row and reason.

## Acceptance criteria

- [ ] Emits exactly 472 cases: 72 each for AS, S, Pi, L, U and T, and 40 for H
- [ ] Every case carries set, group label, index in group, display name, canonical state, and its algorithms with per-algorithm AUF offsets
- [ ] Every algorithm validated: F2L intact, last-layer edges oriented
- [ ] All alternatives within a row resolve to one canonical id
- [ ] Rotation-containing algorithms reconcile correctly. Regression cases that currently fail: AS3 row 1, and T5 row 1 variant c
- [ ] Reject list is empty once `data/fixes.json` is populated
- [ ] Re-running is deterministic and produces byte-identical output

## Blocked by

None - can start immediately.

