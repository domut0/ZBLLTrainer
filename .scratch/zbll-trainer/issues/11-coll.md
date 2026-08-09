# 11 — COLL

Status: ready-for-agent

## What to build

The first new algorithm set, and the one that proves the multi-set plumbing.
COLL needs **no new source data** — it is derived from `data/cases.json` exactly
as it stands, at build time.

Be precise about the definition, because an earlier draft of the plan got it
wrong:

> COLL solves the corners of the last layer with the requirement that edge
> orientation is maintained. **Edge permutation is NOT preserved.**

So a COLL case is corner orientation + corner permutation, ignoring edges
entirely. Grouping the 472 ZBLL cases by that key yields **40 distinct COLL
cases**: 38 containing 12 ZBLL cases each and 2 containing 8 (the symmetric H
ones). By ZBLL subset that is `AS 6, S 6, Pi 6, H 4, L 6, U 6, T 6`. Those
numbers are measured, not estimated — if the build produces anything else, the
derivation is wrong.

Every ZBLL case under a COLL case solves that COLL case's corners, so the COLL
case's algorithms are its group's algorithms: the **first is primary**, the other
eleven (or seven) are alternatives, selectable on the case-detail screen exactly
as the sheet's alternatives already are. Reuse `ProgressRecord.primaryAlgIndex`
and `chosenAlg()` rather than inventing a parallel mechanism.

The diagram is the one real wrinkle. A COLL case has **no defined edge
permutation**, so its diagram must show the corners and mark the four U edges as
"don't care". Add a facelet letter for that and render it grey. Do not reuse a
member ZBLL case's diagram — it would draw a specific edge permutation that is
not part of the case.

This snippet is the grouping, already run and confirmed against the real data:

```js
// A COLL case is corner orientation + permutation, canonicalised over AUF.
function collKey(zbllCase) {
  let p = rebuildPattern(zbllCase.state);
  const forms = [];
  for (let i = 0; i < 4; i++) {
    forms.push(JSON.stringify([
      p.patternData.CORNERS.pieces,
      p.patternData.CORNERS.orientation,
    ]));
    p = p.applyAlg(new Alg("U"));
  }
  return forms.sort()[0];   // lexicographically smallest, like case identity
}
```

## Acceptance criteria

- [ ] Build derives exactly 40 COLL cases from `cases.json`, with group sizes
      38×12 and 2×8, and the per-subset counts above
- [ ] The count and the group sizes are asserted in the build, so a wrong
      derivation fails loudly rather than shipping
- [ ] Each COLL case's algorithms are its ZBLL group's, first as primary, the
      rest as selectable alternatives through the existing mechanism
- [ ] A "don't care" facelet value exists in the schema and renders grey; the
      four U edge positions use it on every COLL diagram
- [ ] `data/SCHEMA.md` amended to cover the new facelet value and the COLL set
- [ ] Set picker offers COLL; browse, case detail, drill, stats and the pool
      filter all work for it
- [ ] Scrambles are precomputed for COLL cases across all four AUFs
- [ ] Reveal shows a correct algorithm for the AUF actually served, with a
      negative-control test that fails if either AUF correction is dropped
- [ ] `npm run data` PASS/PASS, `npm test` green, `npm run typecheck` clean

## Blocked by

- Issue 10
