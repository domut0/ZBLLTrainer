# Handoff — supporting more algorithm sets

Written 2026-08-09, for a fresh agent picking this up cold. Read `HANDOFF.md`
first (what the app is, how it is built, the traps already handled), then this.

**Nothing in here is built yet.** This document is the research and the plan.
The nine original issues are all done and shipped; this is new scope.

---

## What was asked

Support algorithm sets beyond ZBLL: **COLL**, **ZBLS**, **LXS** and **EO**
(the last two from the APB method).

Winter Variation and Summer Variation were **explicitly dropped** — do not
build them, do not ask about them again.

## What is in the repo now

The source CSVs are committed under `data/source/apb/`:

| File | Set | Non-empty lines |
|---|---|---|
| `eopair-dbr.csv` | EO (pair solved in dBR) | 16 |
| `lxs-ufr.csv` | LXS, cases 1–30 | 33 |
| `lxs-rfu.csv` | LXS, cases 31–60 | 31 |
| `lxs-fur.csv` | LXS, cases 61–90 | 32 |
| `lxs-dfr.csv` | LXS, cases 91–98 | 30 |
| `lxs-rdf.csv` | LXS, cases 99–107 | 20 |
| `lxs-frd.csv` | LXS, cases 108–116 | 24 |
| `zbls.csv` | ZBLS (Brina's sheet, by masadl) | 338 |

The seven ZBLL CSVs stay where they are, in `data/source/`.

---

## COLL — free, verified, do this first

**COLL needs no new source data.** It is derivable from `data/cases.json`
exactly as it stands, and this has been verified rather than assumed.

The earlier draft of this plan got COLL wrong, so be clear on the definition:

> COLL solves the corners of the last layer with the requirement that edge
> orientation is maintained. **Edge permutation is NOT preserved.**

(An earlier investigation tested for edge-*preserving* algorithms and found only
20 of 40 covered. That test was answering the wrong question. Ignore it.)

So a **COLL case is corner orientation + corner permutation, ignoring edges
entirely**. Group the 472 ZBLL cases by corner state, canonicalised over the
four U rotations the same way case identity already is. Measured result:

- **40 distinct COLL cases**
- 38 of them contain **12** ZBLL cases each; 2 contain **8** (the symmetric H ones)
- By ZBLL set: `AS 6, S 6, Pi 6, H 4, L 6, U 6, T 6` — which is 40

That matches standard COLL, usually quoted as 42 with duplicates.

### The behaviour that was asked for

Every ZBLL case under a COLL case solves that COLL case's corners. So:

- The COLL case's **primary algorithm is the first of its ZBLL group**.
- The other **11** (or 7) are offered as alternatives, selectable exactly like
  the sheet's alternatives already are on the case-detail screen.

Reuse `ProgressRecord.primaryAlgIndex` and `chosenAlg()` — the machinery exists.

### Working snippet

This is the grouping, already run and confirmed:

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

Diagrams are the one wrinkle: a COLL case has no defined edge permutation, so
its diagram must show the corners and mark the U edges as "don't care" rather
than drawing them yellow-and-solved. Add a facelet letter for that (`?`) and
render it grey. **Do not just reuse a member ZBLL case's diagram** — it would
show a specific edge permutation that is not part of the case.

---

## The APB sets — real work

LXS, EO and ZBLS are all **F2L-stage** sets: the case has an unsolved slot, so
the last-layer-only assumptions baked into the app do not hold.

### What breaks, and must become per-set

1. **`legality()` in `scripts/import-cases.mjs`** hard-requires F2L intact and
   all LL edges oriented. That is the ZBLL predicate. It must become one
   predicate per set.
2. **The 21-sticker facelet model** (`scripts/facelets.mjs`, `data/SCHEMA.md`)
   shows only the last layer. Every APB set needs the last layer **plus the
   FR/DR slot**, and EO needs to show edge *orientation*, which colour alone
   does not convey — an oriented and a misoriented edge can show the same
   sticker on top. Expect a new representation, not a tweak.
3. **`LLDiagram`** draws exactly 21 rects from that string. A stage-aware
   variant is needed. Keep `LLDiagram` working for ZBLL/COLL rather than
   generalising it into something that serves neither well.
4. **Scramble precompute generalises fine** — it builds a target state and
   solves it, and that works for any state. Only the *validity* of the target
   changes.
5. **`data/SCHEMA.md`** is the frozen contract. Amend it deliberately, as was
   done when `facelets` was added.

Case identity still works the same way: **apply the algorithm's inverse to a
solved cube**. That is stage-agnostic. AUF canonicalisation still applies (the
sheets are full of `(U')` prefixes, which are real AUF moves). **Whole-cube
`y` rotations must NOT be canonicalised away** for these sets — the slot has to
stay in a fixed place, unlike ZBLL where orientation is free.

### Per-file parsing notes

All three formats are **column-major**, unlike the ZBLL sheets which are
row-major. Each header cell names a case; the cells *below* it are that case's
alternative algorithms. The existing importer reads rows and will produce
nonsense on these — write a separate parser.

**`lxs-*.csv`** — the most tractable. Start here.
- Row 1 of `lxs-ufr.csv` carries the key: *"Cases are organized first by the
  location of the DFR corner sticker in each sheet name. Then within each sheet
  the cases are organized by the position of the edge that should be at DR and
  the one that should be at FR."*
- Sheet name = where the DFR corner sits and how it is twisted (`UFR`, `RFU`,
  `FUR`, `DFR`, `RDF`, `FRD`).
- Section rows read `DR edge at UF`, `DR edge at UL`, … Carry them forward.
- Header cells read `1: UF/UL` — that is `caseNumber: DRedgePosition/FRedgePosition`.
- Numbering is global 1–116 across the six sheets and is a free correctness
  check: if the parse does not yield exactly 116 distinct cases, it is wrong.

**`eopair-dbr.csv`** — 11 cases.
- Row 1 is a long prose preamble about EO-pair conventions. Skip it.
- Two header blocks (CSV lines 6 and 13). Column titles are the **sets of
  misoriented edges**: `UF/UR`, `UF/UB`, `UF/FR`, `UF/DR`, `FR/DR`,
  `UF/UL/UB/UR`, then `UB/UR/UF/FR`, `UB/UR/UF/DR`, `UF/UR/FR/DR`,
  `UL/UR/FR/DR`, `UF/UL/UB/UR/FR/DR`. Six plus five is **11 cases**.
- `dBR` in the filename means the pair is already solved into the **back-right**
  slot; EO is then done with that pair solved. This is the current standard per
  the sheet's own preamble.
- One cell carries a parenthetical note — `(for misoriented DR)` — which is not
  part of the algorithm. Strip trailing prose.
- **There is a stray algorithm at CSV line 972**, hundreds of blank rows below
  the real data. Bound the parse to the populated region or it will be imported
  as a phantom case. `lxs-fur.csv` has the same problem at line 1016.

**`zbls.csv`** — hardest, do last. ~302 cases.
- A visual grid with heavily quoted multi-line cells, spacer columns and spacer
  rows. Cells hold one to three algorithms each.
- The structure is not row-per-case and not obviously column-per-case either.
  Budget real time to work out the layout before writing the parser, and
  consider asking for a flatter export instead — it may be cheaper than
  reverse-engineering the grid.

### Notation quirks present in these sheets

The existing `normaliseAlg()` handles most of this, but confirm rather than
assume:

- `(U')` / `(U2)` AUF prefixes in **parentheses** — the ZBLL sheets used square
  brackets. These are real moves; stripping them silently produces the wrong case.
- Curly apostrophes, e.g. `R’ F’ (R U R’ U’) R’ F U R` in `lxs-fur.csv`.
- Wide moves and slices throughout: `r`, `f`, `M`, `S`, `u`.
- Whole-cube rotations inside algorithms: `y'`, `z'`, and a `B2'`.
- Trailing spaces on several cells.

---

## Suggested build order

Each step is useful before the next exists, and each de-risks the one after.

1. **Make "algorithm set" first-class.** Schema, importer, browse, drill, stats
   and storage all currently hardcode ZBLL. Progress is keyed by derived case
   ID, so nothing already ticked is lost. **Do this before any new set.**
2. **COLL.** No new data, no new diagram geometry beyond the "don't care" edge
   marking, and it proves the multi-set plumbing end to end.
3. **LXS.** Clean format, a built-in count check at 116, and it forces the
   stage-aware diagram and the per-set validity predicate — the two hardest
   pieces of architecture.
4. **EO.** Only 11 cases, but needs a genuinely different diagram: orientation
   is not a colour. Consider arrows or a two-tone edge marker.
5. **ZBLS.** Largest and messiest. By this point everything it needs exists
   except the parser.

## Do not repeat these mistakes

- **Do not trust a passing test that only exercises the trivial case.** This bit
  twice already on ZBLL. `scrambles.json` is generated grouped by AUF, so the
  first N scrambles of any case are all `auf: 0` — the one orientation needing
  no correction. Sample one per AUF, and write negative controls that fail when
  the logic is deliberately broken.
- **Do not hand-derive cube geometry.** Generate it from cubing.js and check the
  library agrees with the app's kpuzzle, as `scripts/facelets.mjs` does.
- **Do not trust `gem`'s claims.** On this project it reported `tsc --noEmit`
  exiting 0 when it did not, and overcounted its own tests. Re-run everything.
- **Do not regenerate `data/cases.json` casually.** Re-run
  `node scripts/verify-facelets.mjs` and `node scripts/verify-scrambles.mjs`
  after any import change; both must PASS.
