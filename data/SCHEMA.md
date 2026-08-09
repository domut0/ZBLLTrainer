# Data contract

Frozen ahead of the importer so dependent work can start. Issue 02 must produce
exactly this; Issues 03, 06 and 07 may rely on it.

**Amended 2026-08-09 (Issue 12)** — added the `LXS` set from APB: 116 cases
across six source sheets, globally numbered 1–116, which is a free correctness
check on the parse. Introduced **stage facelets** for F2L-stage sets: a
28-character `FaceletString` extending the 21 last-layer stickers with 7 FR/DR
slot stickers at indices 21–27, derived from PuzzleGeometry rather than written
by hand. `AlgSetDef.diagram` selects `'stage'`.

**An LXS case is three pieces, not a cube state.** It is the placement of the
DFR corner and the two edges belonging at DR and FR, with the rest of F2L
intact. **The last layer is not part of the case**, so two algorithms that both
solve LXS routinely leave the last layer differently. Modelling identity as the
full state instead looks fine — the case count still comes out at 116 — and then
silently discards most of the sheet: measured over the six sheets, all 147
alternatives agree on the three pieces and only 7 agree on the full state.
The three are also fully interchangeable: each solves the case from the state
any other was derived from, which is why one scramble per case is enough.

The diagram follows from that. A stage sticker is drawn in colour only when the
piece occupying it is one of the case's three pieces or a solved F2L piece;
every other last-layer sticker is `?`, as COLL's edges are. The mask is computed
from the cube state, not from a fixed index list, because the case pieces move —
"DR edge at UF" versus "at UL" is the sheets' whole organising principle.

`scripts/verify-lxs-reveal.mjs` checks every LXS case, algorithm and AUF
exhaustively — 1060 combinations — rather than sampling. Sampling is what hid
the equivalent COLL defect.

**Amended 2026-08-09 (Issue 11)** — added the `COLL` set, derived at build time
from the ZBLL cases rather than from any new source data. Added `?` to the
`FaceletString` alphabet for a "don't care" sticker, used at the four
last-layer edge positions: a COLL case has no defined edge permutation, so
drawing one would be a lie.

A COLL case's algorithms are borrowed from the twelve ZBLL cases under it, and
each one's `aufOffset` is **re-solved against the COLL representative** rather
than inherited. The inherited offset was solved against the member's own
canonical orientation, which differs by a U rotation whenever the corner state
is symmetric — five of the 472 borrowed algorithms, each producing a reveal
that did not solve the cube. `scripts/verify-coll-reveal.mjs` checks all 1888
case/algorithm/AUF combinations exhaustively; sampling missed exactly these.

**Amended 2026-08-08 (Issue 10)** — a case now names the *algorithm set* it
belongs to. `set` became two fields, `algSet` and `subset`, because the word was
doing two jobs: naming ZBLL's seven OLL-derived groupings while ZBLL itself went
unnamed. Nothing else moved, and no case id changed — ids derive from the cube
state, and `src/data/algSets.test.ts` asserts all 472 against a fixture captured
before the change.

What varies per algorithm set, and therefore must not be assumed anywhere:

| | Varies how |
|---|---|
| **Validity rule** | ZBLL requires F2L intact and all LL edges oriented. The F2L-stage sets do not. `legality()` in the importer becomes one predicate per set (Issue 12). |
| **Diagram representation** | ZBLL and COLL are last-layer only, the 21-sticker string below. Stage sets need the LL plus the FR/DR slot, and EO needs orientation shown as something other than colour. `AlgSetDef.diagram` selects. |
| **Subset vocabulary** | ZBLL has seven; another set may have its own, or none. `AlgSetDef.subsets` is the enumerable list; `subset` is `""` for a set without them. |
| **AUF/rotation canonicalisation** | ZBLL is free to rotate. Stage sets must keep the slot in a fixed place, so whole-cube `y` must not be canonicalised away. |

The registry lives in `src/data/algSets.ts`. `AlgSetId` names every planned set;
`ALG_SETS` holds the ones that exist, and the UI enumerates that array, never
the type.

**Amended 2026-08-08** — added `facelets` to `ZbllCase`. Issue 03 originally had
the diagram component derive sticker colours from the orbit arrays below. That is
error-prone 3D geometry whose failure mode is 472 plausible-looking wrong
diagrams, so the derivation moved into the build, where
`scripts/verify-facelets.mjs` can assert it. Nothing was removed; `state` is
still the identity and is still what the scramble precompute works from.

## `data/cases.json`

```ts
/** Every planned algorithm set. Only those in `ALG_SETS` exist today. */
type AlgSetId = "ZBLL" | "COLL" | "LXS" | "EO" | "ZBLS";

/** The seven ZBLL subsets — groupings *within* ZBLL, named for their OLL case. */
type ZbllSubset = "T" | "U" | "L" | "H" | "Pi" | "S" | "AS";

/**
 * A cube state, in the orbit layout cubing.js uses for 3x3x3.
 * Indices 0-3 of each orbit are the U layer (verified empirically in
 * scripts/spike.mjs by diffing a U turn against the solved pattern).
 *
 * CORNERS: 8 pieces, orientation 0-2
 * EDGES:  12 pieces, orientation 0-1
 *
 * Centres are omitted: face turns never permute them, and the importer has
 * already normalised away any net rotation introduced by x/y/z in an algorithm.
 */
interface CubeState {
  corners: { pieces: number[]; orientation: number[] }; // length 8
  edges: { pieces: number[]; orientation: number[] };   // length 12
}

interface CaseAlg {
  /** Cleaned algorithm, bracketed AUF unwrapped into real moves. */
  alg: string;
  /**
   * Which of the four U rotations maps this algorithm's state onto the case's
   * canonical state. Issue 07 uses this to show a correct algorithm for a
   * randomly served orientation.
   */
  aufOffset: 0 | 1 | 2 | 3;
}

interface TrainerCase {
  /** Canonical, stable across re-imports. Derived from the state, not the sheet. */
  id: string;
  /** Which algorithm set this case belongs to. */
  algSet: AlgSetId;
  /** Grouping within that set — a `ZbllSubset` for ZBLL. "" if the set has none. */
  subset: string;
  /** Group label exactly as written in the sheet, e.g. "Pi3: Lines". */
  group: string;
  /** 1-based position within the group. */
  indexInGroup: number;
  /** e.g. "Pi3: Lines #4" */
  displayName: string;
  /** The canonical representative of the AUF orbit. */
  state: CubeState;
  /**
   * The rendered last layer (or stage diagram), one entry per AUF, indexed 0-3
   * with the same meaning as `Scramble.auf` below: entry k is the case with k
   * quarter-turns of the top layer applied. A scramble tagged `auf: k` lands on
   * `facelets[k]` exactly — asserted end-to-end in scripts/verify-facelets.mjs.
   */
  facelets: [FaceletString, FaceletString, FaceletString, FaceletString];
  algs: CaseAlg[];
}

type CasesFile = TrainerCase[]; // 628 entries: 472 ZBLL + 40 derived COLL + 116 LXS
```

### `FaceletString`

21 characters for last-layer sets (ZBLL, COLL), 28 characters for stage sets (LXS). One per visible sticker. Colours are single letters:

| Letter | Colour | Face |
|---|---|---|
| `Y` | yellow | U |
| `G` | green | F |
| `O` | orange | R |
| `B` | blue | B |
| `R` | red | L |
| `W` | white | D — **never in a last-layer diagram**; appears on stage slot stickers |
| `?` | grey | don't care — **used for COLL edges** |

Index layout for last-layer diagrams (21 stickers):

```
        9 10 11            <- B bar, above the square
    18   0  1  2   12
    19   3  4  5   13      <- L bar (left), R bar (right)
    20   6  7  8   14
       15 16 17            <- F bar, below the square
```

- **0–8** — the U face, row-major. Row 0 is the back row, column 0 is the left column. Index 4 is the centre and is always `Y`.
- **9–11** — B bar, left to right as drawn.
- **12–14** — R bar, top to bottom as drawn.
- **15–17** — F bar, left to right as drawn.
- **18–20** — L bar, top to bottom as drawn.

For F2L-stage sets (LXS): 28 characters. Indices 0–20 are the last-layer stickers above; indices 21–27 are the 7 FR/DR slot stickers derived directly from PuzzleGeometry:
- **21** — FR edge, F sticker
- **22** — FR edge, R sticker
- **23** — DFR corner, F sticker
- **24** — DFR corner, R sticker
- **25** — DFR corner, D sticker
- **26** — DR edge, R sticker
- **27** — DR edge, D sticker

Each bar is already ordered to line up with the edge of the square it touches,
so a renderer never has to reason about the cube. Invariants that hold for every
case and every AUF, and are checked in `scripts/verify-facelets.mjs`:

- For ZBLL:
  - exactly nine `Y`, and exactly three each of `G`, `O`, `B`, `R`
  - no `W` anywhere
  - indices 1, 3, 5, 7 are always `Y` — every last-layer edge is oriented in ZBLL
  - all 472 `facelets[0]` values are distinct, because the 21 stickers determine
    the last-layer state completely
- For COLL:
  - exactly eight `?`, at the edge positions (indices 1, 3, 5, 7, 10, 13, 16, 19)
  - exactly five `Y` (the oriented corner U stickers plus center) and exactly two each of `G`, `O`, `B`, `R` (corner side stickers)
  - no `W` anywhere
  - all 40 `facelets[0]` values are distinct, because the 12 corner stickers determine the last-layer corner state completely

Counts:
- ZBLL, per subset: 72 each for `T`, `U`, `L`, `Pi`, `S`, `AS`; 40 for `H`.
  The H sheet's header says 0/72 — that is a copy-paste artifact in the source,
  not a target.
- COLL, per ZBLL subset: 6 each for `T`, `U`, `L`, `Pi`, `S`, `AS`; 4 for `H` (= 40 cases total).

## `data/scrambles.json`

```ts
interface Scramble {
  scramble: string;
  /** The AUF this scramble presents the case at. */
  auf: 0 | 1 | 2 | 3;
}

type ScramblesFile = Record<string /* case id */, Scramble[]>;
```

Roughly 20 per case, spread across the four AUFs.

## Orientation

Yellow top, green front, white bottom, standard Western scheme. Fixed everywhere:
scrambles assume it and diagrams draw it.
