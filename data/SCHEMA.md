# Data contract

Frozen ahead of the importer so dependent work can start. Issue 02 must produce
exactly this; Issues 03, 06 and 07 may rely on it.

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
  algs: CaseAlg[];
}

type CasesFile = ZbllCase[]; // exactly 472 entries
```

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
