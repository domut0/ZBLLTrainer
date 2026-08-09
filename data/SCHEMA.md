# Data contract

Frozen ahead of the importer so dependent work can start. Issue 02 must produce
exactly this; Issues 03, 06 and 07 may rely on it.

**Amended 2026-08-08** — added `facelets` to `ZbllCase`. Issue 03 originally had
the diagram component derive sticker colours from the orbit arrays below. That is
error-prone 3D geometry whose failure mode is 472 plausible-looking wrong
diagrams, so the derivation moved into the build, where
`scripts/verify-facelets.mjs` can assert it. Nothing was removed; `state` is
still the identity and is still what the scramble precompute works from.

## `data/cases.json`

```ts
type CaseSet = "T" | "U" | "L" | "H" | "Pi" | "S" | "AS";

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

interface ZbllCase {
  /** Canonical, stable across re-imports. Derived from the state, not the sheet. */
  id: string;
  set: CaseSet;
  /** Group label exactly as written in the sheet, e.g. "Pi3: Lines". */
  group: string;
  /** 1-based position within the group. */
  indexInGroup: number;
  /** e.g. "Pi3: Lines #4" */
  displayName: string;
  /** The canonical representative of the AUF orbit. */
  state: CubeState;
  /**
   * The rendered last layer, one entry per AUF, indexed 0-3 with the same
   * meaning as `Scramble.auf` below: entry k is the case with k quarter-turns
   * of the top layer applied. A scramble tagged `auf: k` lands on `facelets[k]`
   * exactly — asserted end-to-end in scripts/verify-facelets.mjs.
   */
  facelets: [FaceletString, FaceletString, FaceletString, FaceletString];
  algs: CaseAlg[];
}

type CasesFile = ZbllCase[]; // exactly 472 entries
```

### `FaceletString`

21 characters, one per visible last-layer sticker. Colours are single letters:

| Letter | Colour | Face |
|---|---|---|
| `Y` | yellow | U |
| `G` | green | F |
| `O` | orange | R |
| `B` | blue | B |
| `R` | red | L |
| `W` | white | D — **never appears in a last-layer diagram** |

Index layout, as the diagram is drawn (green front at the bottom):

```
        9 10 11            <- B bar, above the square
    18   0  1  2   12
    19   3  4  5   13      <- L bar (left), R bar (right)
    20   6  7  8   14
       15 16 17            <- F bar, below the square
```

- **0–8** — the U face, row-major. Row 0 is the back row, column 0 is the left
  column. Index 4 is the centre and is always `Y`.
- **9–11** — B bar, left to right as drawn.
- **12–14** — R bar, top to bottom as drawn.
- **15–17** — F bar, left to right as drawn.
- **18–20** — L bar, top to bottom as drawn.

Each bar is already ordered to line up with the edge of the square it touches,
so a renderer never has to reason about the cube. Invariants that hold for every
case and every AUF, and are checked in `scripts/verify-facelets.mjs`:

- exactly nine `Y`, and exactly three each of `G`, `O`, `B`, `R`
- no `W` anywhere
- indices 1, 3, 5, 7 are always `Y` — every last-layer edge is oriented in ZBLL
- all 472 `facelets[0]` values are distinct, because the 21 stickers determine
  the last-layer state completely

Counts: 72 each for `T`, `U`, `L`, `Pi`, `S`, `AS`; 40 for `H`. The H sheet's
header says 0/72 — that is a copy-paste artifact in the source, not a target.

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
