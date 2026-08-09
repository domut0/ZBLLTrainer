# 12 — LXS

Status: ready-for-agent

The architecturally hardest issue in this batch. It is first of the APB sets
because its format is the cleanest and it carries a built-in correctness check,
so it is the safest place to force the two pieces of architecture that every
remaining set needs.

## What to build

LXS is an **F2L-stage** set: the case has an unsolved slot, so the
last-layer-only assumptions baked into the app do not hold. Three things have to
change, and then the parser is comparatively easy.

**Per-set validity.** `legality()` in `scripts/import-cases.mjs` hard-requires
F2L intact and all LL edges oriented. That is the ZBLL predicate, stated as if it
were a universal truth. It becomes one predicate per set.

**A stage-aware facelet model.** The current 21-sticker string shows only the
last layer. LXS needs the last layer **plus the FR/DR slot**. This is new
geometry and must be *generated from cubing.js* and cross-checked against the
importer's kpuzzle, the way `scripts/facelets.mjs` already does for the last
layer — hand-deriving sticker colours is what stalled Issue 03, and its failure
mode is a few hundred plausible-looking wrong diagrams.

**A stage-aware diagram component.** `LLDiagram` draws exactly 21 rects and
serves ZBLL and COLL well. Add a sibling for stage cases rather than
generalising `LLDiagram` into something that serves neither.

Case identity is unchanged and stage-agnostic: apply the algorithm's inverse to a
solved cube. AUF canonicalisation still applies — the sheets are full of `(U')`
prefixes and those are real moves. But **whole-cube `y` rotations must NOT be
canonicalised away** for stage sets: the slot has to stay in a fixed place,
unlike ZBLL where orientation is free.

**The parser.** The six `lxs-*.csv` files are **column-major**, unlike the ZBLL
sheets. Each header cell names a case; the cells below it are that case's
alternative algorithms. The existing row-reading importer produces nonsense on
these — write a separate parser.

- Sheet name = where the DFR corner sits and how it is twisted: `UFR`, `RFU`,
  `FUR`, `DFR`, `RDF`, `FRD`.
- Section rows read `DR edge at UF`, `DR edge at UL`, … and carry forward.
- Header cells read `1: UF/UL`, i.e. `caseNumber: DRedgePosition/FRedgePosition`.
- Numbering is global 1–116 across the six sheets. **That is a free correctness
  check** — a parse that does not yield exactly 116 distinct cases is wrong.
- `lxs-fur.csv` has a stray algorithm hundreds of blank rows below the real data,
  at line 1016. Bound the parse to the populated region or it becomes a phantom
  case.

Notation quirks to confirm `normaliseAlg()` handles rather than assume:
parenthesised AUF prefixes `(U')` / `(U2)` (the ZBLL sheets used square
brackets), curly apostrophes, wide moves and slices (`r`, `f`, `M`, `S`, `u`),
whole-cube rotations inside algorithms (`y'`, `z'`, a `B2'`), and trailing spaces.

## Acceptance criteria

- [ ] `legality()` is per-set; the ZBLL predicate still rejects exactly what it
      rejected before, verified by re-running the ZBLL import unchanged
- [ ] Stage facelet geometry is generated from cubing.js and cross-checked
      against the importer's kpuzzle, not hand-written
- [ ] A verify script asserts the stage facelets the way
      `scripts/verify-facelets.mjs` does for the last layer, and it PASSes
- [ ] `LLDiagram` is unchanged and still serves ZBLL and COLL; stage cases render
      through a separate component showing LL + the FR/DR slot
- [ ] LXS parse yields exactly 116 distinct cases across the six sheets
- [ ] Parsing is bounded to the populated region — no phantom case from
      `lxs-fur.csv` line 1016
- [ ] `y` rotations are not canonicalised away for LXS; a test covers a case
      whose algorithm contains one
- [ ] Every parsed algorithm survives round-trip: applying it to the case state
      solves it
- [ ] `data/SCHEMA.md` amended for the stage facelet representation
- [ ] Scrambles precomputed for LXS across all four AUFs; reveal correct for the
      AUF served, with negative controls
- [ ] `npm run data` PASS/PASS, `npm test` green, `npm run typecheck` clean

## Blocked by

- Issue 11
