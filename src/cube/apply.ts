import type { AlgSetId, Auf, CubeState } from '@/data/types'
import { MOVES, type MoveTable } from './moves.generated'

/**
 * A 3x3x3 you can turn, and nothing more.
 *
 * Issue 05 lets the user paste an algorithm the spreadsheet does not have, and
 * that has to be checked — parsed, inverted, and confirmed to produce this case
 * — before it is stored. Storing one that does not work would show a wrong
 * algorithm at the table, which is the whole failure mode this app is trying to
 * avoid.
 *
 * Doing that needs a cube in the browser but *not* a solver. The PRD is
 * explicit that no solver ships in the client bundle (§7b): cubing.js is over a
 * megabyte with a WASM payload, and it exists to search, which we never do here
 * — the scrambles were all precomputed at build time. So this applies moves and
 * compares states, in about a hundred lines, against tables generated from
 * cubing.js by scripts/gen-move-tables.mjs.
 */

export interface Move {
  /** A quantum move: one of the keys of MOVES. */
  quantum: string
  /** Quarter turns clockwise: 1, 2 or 3. */
  amount: 1 | 2 | 3
}

export const SOLVED: CubeState = {
  corners: { pieces: [0, 1, 2, 3, 4, 5, 6, 7], orientation: [0, 0, 0, 0, 0, 0, 0, 0] },
  edges: {
    pieces: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    orientation: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  },
}

export const cloneState = (s: CubeState): CubeState => ({
  corners: { pieces: [...s.corners.pieces], orientation: [...s.corners.orientation] },
  edges: { pieces: [...s.edges.pieces], orientation: [...s.edges.orientation] },
})

/**
 * One quarter turn. Follows the same convention as cubing.js's KPuzzle: the
 * piece landing in slot i is the one that was in slot `permutation[i]`, and its
 * twist picks up `orientationDelta[i]`. apply.test.ts checks this against
 * cubing.js on every algorithm in the dataset, so a sign error cannot survive.
 */
function turn(state: CubeState, m: MoveTable): CubeState {
  const cp = state.corners.pieces
  const co = state.corners.orientation
  const ep = state.edges.pieces
  const eo = state.edges.orientation

  const nextCp = new Array<number>(8)
  const nextCo = new Array<number>(8)
  for (let i = 0; i < 8; i += 1) {
    const from = m.cp[i]
    nextCp[i] = cp[from]
    nextCo[i] = (co[from] + m.co[i]) % 3
  }

  const nextEp = new Array<number>(12)
  const nextEo = new Array<number>(12)
  for (let i = 0; i < 12; i += 1) {
    const from = m.ep[i]
    nextEp[i] = ep[from]
    nextEo[i] = (eo[from] + m.eo[i]) % 2
  }

  return {
    corners: { pieces: nextCp, orientation: nextCo },
    edges: { pieces: nextEp, orientation: nextEo },
  }
}

export function applyMoves(state: CubeState, moves: readonly Move[]): CubeState {
  let out = state
  for (const move of moves) {
    const table = MOVES[move.quantum]
    if (!table) throw new Error(`unknown move ${move.quantum}`)
    for (let n = 0; n < move.amount; n += 1) out = turn(out, table)
  }
  return out
}

export const invertMoves = (moves: readonly Move[]): Move[] =>
  [...moves].reverse().map((m) => ({ quantum: m.quantum, amount: (4 - m.amount) as 1 | 2 | 3 }))

export function statesEqual(a: CubeState, b: CubeState): boolean {
  const same = (x: readonly number[], y: readonly number[]) =>
    x.length === y.length && x.every((v, i) => v === y[i])
  return (
    same(a.corners.pieces, b.corners.pieces) &&
    same(a.corners.orientation, b.corners.orientation) &&
    same(a.edges.pieces, b.edges.pieces) &&
    same(a.edges.orientation, b.edges.orientation)
  )
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const ZERO_WIDTH = /[​-‍﻿ ]/g

/**
 * Normalises the way scripts/import-cases.mjs does, so an algorithm typed by
 * the user is read exactly as one from the spreadsheet would be. Handles curly
 * apostrophes, bracketed AUFs, grouping parentheses, and `Rw` for `r`.
 */
export function normaliseAlgText(raw: string): string {
  return (
    raw
      .replace(ZERO_WIDTH, ' ')
      .replace(/[‘’ʼ′]/g, "'")
      .replace(/\[\s*(U2|U'|U)\s*\]/g, ' $1 ')
      .replace(/[()[\]]/g, ' ')
      // The sheet writes fingertrick variants as a trailing "... U L' / r'".
      // The importer drops them; do the same so pasting from the sheet works.
      .replace(/\s*\/.*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/** letter, optional w, optional 2 or ' (or 2', which is just a half turn). */
const TOKEN = /^([URFDLBMESxyzurfdlb])(w?)(2'?|')?$/

const UPPER_FACES = 'URFDLB'
const LOWER_FACES = 'urfdlb'

export type ParseResult = { ok: true; moves: Move[] } | { ok: false; reason: string }

export function parseAlg(raw: string): ParseResult {
  const text = normaliseAlgText(raw)
  if (!text) return { ok: false, reason: 'Enter an algorithm.' }

  const moves: Move[] = []
  for (const token of text.split(' ')) {
    if (!token) continue
    const match = TOKEN.exec(token)
    if (!match) return { ok: false, reason: `Could not read "${token}".` }

    const [, letter, wide, modifier] = match

    // A two-layer turn is written either `Rw` or lowercase `r`. Slices and
    // rotations have no wide form.
    let quantum: string
    if (UPPER_FACES.includes(letter)) quantum = wide ? letter.toLowerCase() : letter
    else if (LOWER_FACES.includes(letter)) {
      if (wide) return { ok: false, reason: `Could not read "${token}".` }
      quantum = letter
    } else {
      if (wide) return { ok: false, reason: `"${letter}" has no wide form.` }
      quantum = letter
    }

    if (!MOVES[quantum]) return { ok: false, reason: `Unknown move "${token}".` }

    // R2 and R2' are the same half turn.
    const amount: 1 | 2 | 3 = modifier?.startsWith('2') ? 2 : modifier === "'" ? 3 : 1
    moves.push({ quantum, amount })
  }

  if (!moves.length) return { ok: false, reason: 'Enter an algorithm.' }
  return { ok: true, moves }
}

// ---------------------------------------------------------------------------
// Validating a pasted algorithm against a case
// ---------------------------------------------------------------------------

const AUF_SEQUENCES: Move[][] = [
  [],
  [{ quantum: 'U', amount: 1 }],
  [{ quantum: 'U', amount: 2 }],
  [{ quantum: 'U', amount: 3 }],
]

/** The same 24 whole-cube rotations the importer brute-forces over. */
const ROTATIONS: Move[][] = (() => {
  const out: Move[][] = []
  const around: Move[][] = [
    [],
    [{ quantum: 'x', amount: 1 }],
    [{ quantum: 'x', amount: 2 }],
    [{ quantum: 'x', amount: 3 }],
    [{ quantum: 'z', amount: 1 }],
    [{ quantum: 'z', amount: 3 }],
  ]
  const spin: Move[][] = [
    [],
    [{ quantum: 'y', amount: 1 }],
    [{ quantum: 'y', amount: 2 }],
    [{ quantum: 'y', amount: 3 }],
  ]
  for (const a of around) for (const b of spin) out.push([...a, ...b])
  return out
})()

export type ValidationResult =
  | { ok: true; alg: string; aufOffset: Auf }
  | { ok: false; reason: string }

/**
 * When a candidate state counts as being the target case.
 *
 * ZBLL fixes the whole last layer, so nothing short of an exact match will do.
 * COLL fixes the corners and requires edge ORIENTATION to survive, but leaves
 * edge PERMUTATION free — that is the definition of the set, and checking
 * permutation here would reject most of a COLL case's own algorithms.
 */
const LXS_CORNER = 4
const LXS_EDGES = [5, 8]

function lxsKey(s: CubeState): string {
  const at = s.corners.pieces.indexOf(LXS_CORNER)
  return JSON.stringify([
    at,
    s.corners.orientation[at],
    ...LXS_EDGES.map((pc) => {
      const i = s.edges.pieces.indexOf(pc)
      return [i, s.edges.orientation[i]]
    }),
  ])
}

function matcherFor(algSet: AlgSetId): (state: CubeState, target: CubeState) => boolean {
  if (algSet === 'COLL') {
    return (state, target) => {
      const cornersMatch =
        state.corners.pieces.every((v, i) => v === target.corners.pieces[i]) &&
        state.corners.orientation.every((v, i) => v === target.corners.orientation[i])
      const f2lEdgesHome = state.edges.pieces.slice(4).every((v, i) => v === i + 4)
      const edgesOriented = state.edges.orientation.every((v) => v === 0)
      return cornersMatch && f2lEdgesHome && edgesOriented
    }
  }

  if (algSet === 'LXS') {
    return (state, target) => {
      for (let i = 5; i <= 7; i += 1) {
        if (state.corners.pieces[i] !== i || state.corners.orientation[i] !== 0) return false
      }
      for (const i of [4, 6, 7, 9, 10, 11]) {
        if (state.edges.pieces[i] !== i || state.edges.orientation[i] !== 0) return false
      }
      return lxsKey(state) === lxsKey(target)
    }
  }

  return statesEqual
}

/**
 * Checks a pasted algorithm actually solves `target`, and works out the AUF
 * offset the reveal will need.
 *
 * Mirrors scripts/import-cases.mjs: the case is `prefix . alg^-1` applied to a
 * solved cube, where the prefix absorbs both the trailing AUF the spreadsheet
 * omits and any whole-cube rotation an algorithm containing x/y/z or a wide
 * move leaves behind. Both corrections go to the LEFT of the inverted
 * algorithm — getting that backwards is what produced 266 false rejects during
 * the import, and it would reject perfectly good algorithms here too.
 *
 * What counts as "solves it" is per-set, so `algSet` is required rather than
 * defaulted: a default would quietly re-create the ZBLL-is-the-only-set
 * assumption that Issue 10 spent its whole diff removing.
 */
export function validateAlgForCase(
  raw: string,
  target: CubeState,
  algSet: AlgSetId,
): ValidationResult {
  const parsed = parseAlg(raw)
  if (!parsed.ok) return { ok: false, reason: parsed.reason }

  const inverse = invertMoves(parsed.moves)
  const matches = matcherFor(algSet)

  for (let auf = 0; auf < 4; auf += 1) {
    for (const rotation of ROTATIONS) {
      const state = applyMoves(SOLVED, [...rotation, ...AUF_SEQUENCES[auf], ...inverse])
      if (matches(state, target)) {
        return { ok: true, alg: normaliseAlgText(raw), aufOffset: auf as Auf }
      }
    }
  }

  return {
    ok: false,
    reason: 'That algorithm does not solve this case. Check it is written for a yellow top and green front.',
  }
}
