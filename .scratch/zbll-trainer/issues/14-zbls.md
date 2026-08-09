# 14 — ZBLS

Status: ready-for-agent

## What to build

The largest and messiest set, deliberately last. By the time this starts,
everything it needs already exists except the parser: stage-aware validity, the
stage facelet model, the stage diagram and the multi-set plumbing all landed in
Issues 10 and 12.

`data/source/apb/zbls.csv` is Brina's sheet, by masadl — ~302 cases in 338
non-empty lines. It is a **visual grid**, not a table: heavily quoted multi-line
cells, spacer columns, spacer rows, and cells holding one to three algorithms
each. The structure is not row-per-case, and it is not obviously column-per-case
either.

Budget real time to work out the layout **before** writing the parser. Read the
raw bytes, map which cells are real and which are spacers, and write down the
grid's rules; do not start pattern-matching your way through it. If the layout
resists, asking the user for a flatter export is a legitimate and probably
cheaper outcome than reverse-engineering the grid — say so rather than shipping
a parser you do not trust.

The correctness check is weaker here than for LXS and EO, which had exact
counts. Lean on the round-trip instead: every parsed algorithm, applied to its
derived case state, must solve it. That catches a misread cell in a way a case
count does not.

Same notation quirks as the other APB sheets: parenthesised AUF prefixes, curly
apostrophes, wide moves and slices, whole-cube rotations, trailing spaces. And
the same rule as LXS — `y` rotations must not be canonicalised away, because the
slot has to stay put.

## Acceptance criteria

- [ ] The grid layout is documented in the repo before the parser is written —
      which cells are cases, which are spacers, how algorithms group
- [ ] Parse yields the expected case count, with the derivation of that expected
      number written down rather than taken from the parse output
- [ ] Multi-line quoted cells are read whole; cells with two or three algorithms
      produce alternatives on one case, not separate cases
- [ ] Every parsed algorithm round-trips: applied to its case state, it solves it
- [ ] Spacer rows and columns produce no cases
- [ ] `y` rotations are not canonicalised away
- [ ] Set picker offers ZBLS; browse, case detail, drill, stats and pool filter
      all work for it
- [ ] Scrambles precomputed across all four AUFs; reveal correct for the AUF
      served, with negative controls
- [ ] `npm run data` PASS/PASS, `npm test` green, `npm run typecheck` clean

## Blocked by

- Issue 12
