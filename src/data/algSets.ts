import type { AlgSetId, CaseSubset } from './types'
import { ZBLL_SUBSETS } from './types'

/**
 * The registry of algorithm sets the app actually ships.
 *
 * `AlgSetId` names every set that is planned; this array is the subset of them
 * that exists. The UI enumerates *this*, never the type, so adding a set is one
 * entry here plus its importer — no view has to learn its name.
 */
export interface AlgSetDef {
  id: AlgSetId
  /** Shown on the set picker. */
  label: string
  /** One line, for the picker's subtitle. */
  blurb: string
  /**
   * Subset labels in display order. Empty when the set has no subsets, in which
   * case browse skips straight from the set to its groups.
   */
  subsets: readonly CaseSubset[]
  /**
   * Which diagram a case in this set is drawn with. Last-layer sets use the
   * 21-sticker `LLDiagram`; the F2L-stage sets (Issue 12 onward) need a
   * representation that includes the FR/DR slot, so this is the seam where that
   * choice is made rather than another `if` inside the component.
   */
  diagram: 'last-layer' | 'stage' | 'eo'
}

export const ALG_SETS: readonly AlgSetDef[] = [
  {
    id: 'ZBLL',
    label: 'ZBLL',
    blurb: 'Last layer in one, edges already oriented',
    subsets: ZBLL_SUBSETS,
    diagram: 'last-layer',
  },
  {
    id: 'COLL',
    label: 'COLL',
    blurb: 'Last layer corners, preserving edge orientation',
    subsets: [],
    diagram: 'last-layer',
  },
  {
    id: 'LXS',
    label: 'LXS',
    blurb: 'Last extension slot: FR/DR slot plus last layer',
    subsets: [],
    diagram: 'stage',
  },
  {
    id: 'EO',
    label: 'EO',
    blurb: 'Edge orientation: 6-edge orientation with back-right pair solved',
    subsets: [],
    diagram: 'eo',
  },
]

export const ALG_SET_BY_ID: ReadonlyMap<AlgSetId, AlgSetDef> = new Map(
  ALG_SETS.map((s) => [s.id, s]),
)

/** The set browse and drill open on, and the fallback for an unknown stored id. */
export const DEFAULT_ALG_SET: AlgSetId = 'ZBLL'

/** Narrows an arbitrary string — a localStorage value, say — to a live set id. */
export function asAlgSetId(value: unknown): AlgSetId {
  return typeof value === 'string' && ALG_SET_BY_ID.has(value as AlgSetId)
    ? (value as AlgSetId)
    : DEFAULT_ALG_SET
}
