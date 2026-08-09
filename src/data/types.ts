// Mirrors data/SCHEMA.md. That file is the contract; this is its TypeScript
// face. If they ever disagree, SCHEMA.md is right.

/**
 * An algorithm set: a body of cases with its own source data, its own validity
 * rule and its own diagram style. Not to be confused with a *subset*, which is
 * a grouping within one set.
 *
 * The union names every set the app is planned to support. Only the sets in
 * `ALG_SETS` (src/data/algSets.ts) actually exist; that registry, not this
 * type, is what the UI enumerates.
 */
export type AlgSetId = 'ZBLL' | 'COLL' | 'LXS' | 'EO' | 'ZBLS'

/**
 * The seven ZBLL subsets, named for the OLL case they start from. These are
 * subsets *within* ZBLL — they were called `CaseSet` back when ZBLL was the
 * only set and the distinction did not exist.
 */
export type ZbllSubset = 'T' | 'U' | 'L' | 'H' | 'Pi' | 'S' | 'AS'

export const ZBLL_SUBSETS: readonly ZbllSubset[] = ['T', 'U', 'L', 'H', 'Pi', 'S', 'AS']

/**
 * A case's subset label. Typed as a plain string rather than a union because
 * every set has its own vocabulary, and a set may have none — in which case
 * this is the empty string. `ALG_SETS[n].subsets` is the enumerable list.
 */
export type CaseSubset = string

/** 0-3, a number of quarter-turns of the top layer. */
export type Auf = 0 | 1 | 2 | 3

/**
 * 21 sticker colours for one last layer. Index layout, as drawn:
 *
 * ```
 *         9 10 11          <- B bar, above the square
 *     18   0  1  2   12
 *     19   3  4  5   13    <- L bar (left), R bar (right)
 *     20   6  7  8   14
 *        15 16 17          <- F bar, below the square
 * ```
 *
 * 0-8 are the U face row-major, back row first, left column first; index 4 is
 * the centre and is always yellow. Each bar is already ordered to line up with
 * the edge of the square it touches.
 */
export type FaceletString = string

export type FaceletColour = 'Y' | 'G' | 'O' | 'B' | 'R' | 'W' | '?' | '0' | '1'

export interface CubeState {
  corners: { pieces: number[]; orientation: number[] }
  edges: { pieces: number[]; orientation: number[] }
}

export interface CaseAlg {
  /** Cleaned algorithm, bracketed AUF unwrapped into real moves. */
  alg: string
  /** Which U rotation maps this algorithm's state onto the case's canonical state. */
  aufOffset: Auf
}

export interface TrainerCase {
  /** Canonical, derived from the cube state. Stable across re-imports. */
  id: string
  /** Which algorithm set this case belongs to. */
  algSet: AlgSetId
  /** Subset within that set, e.g. `"Pi"` for ZBLL. Empty if the set has none. */
  subset: CaseSubset
  /** Group label exactly as written in the source sheet, e.g. "Pi3: Lines". */
  group: string
  indexInGroup: number
  displayName: string
  state: CubeState
  /** One diagram per AUF, indexed to match `Scramble.auf`. */
  facelets: [FaceletString, FaceletString, FaceletString, FaceletString]
  algs: CaseAlg[]
}

export interface Scramble {
  scramble: string
  /** The AUF this scramble presents the case at. */
  auf: Auf
}

export type ScramblesByCaseId = Record<string, Scramble[]>

/** The number of stickers in a last-layer diagram. */
export const FACELET_COUNT = 21

/** Index of the U centre within a `FaceletString`. It is always yellow. */
export const U_CENTRE_INDEX = 4

/** Screen colours for each facelet letter. */
export const FACELET_FILL: Record<FaceletColour, string> = {
  Y: '#f5d915',
  G: '#00a651',
  O: '#ff6d00',
  B: '#0051ba',
  R: '#c41e3a',
  W: '#f5f5f5',
  '?': '#71717a',
  '0': '#22c55e',
  '1': '#ef4444',
}
