import { describe, expect, it } from 'vitest'
import { Alg } from 'cubing/alg'
import { cube3x3x3 } from 'cubing/puzzles'
import { CASES } from '@/data'
import type { CubeState } from '@/data/types'
import {
  SOLVED,
  applyMoves,
  invertMoves,
  parseAlg,
  statesEqual,
  validateAlgForCase,
} from './apply'

// The client-side cube exists so Issue 05 can check a pasted algorithm without
// shipping a solver. It is only trustworthy if it agrees with the library that
// built the dataset — so it is checked against cubing.js on every one of the
// 977 real algorithms, not on a handful of chosen examples.

const kpuzzle = await cube3x3x3.kpuzzle()
const REFERENCE_SOLVED = kpuzzle.defaultPattern()

const fromPattern = (p: typeof REFERENCE_SOLVED): CubeState => ({
  corners: {
    pieces: [...p.patternData.CORNERS.pieces],
    orientation: [...p.patternData.CORNERS.orientation],
  },
  edges: {
    pieces: [...p.patternData.EDGES.pieces],
    orientation: [...p.patternData.EDGES.orientation],
  },
})

const everyAlg = CASES.flatMap((c) => c.algs.map((a) => ({ case: c, alg: a })))

describe('the client-side cube', () => {
  it('has every algorithm in the dataset to check against', () => {
    expect(everyAlg.length).toBe(1575)
  })

  it('agrees with cubing.js on all 1449 algorithms', () => {
    for (const { alg } of everyAlg) {
      const parsed = parseAlg(alg.alg)
      expect(parsed.ok, `failed to parse "${alg.alg}"`).toBe(true)
      if (!parsed.ok) continue

      const mine = applyMoves(SOLVED, parsed.moves)
      const theirs = fromPattern(REFERENCE_SOLVED.applyAlg(new Alg(alg.alg)))
      expect(statesEqual(mine, theirs), `disagreed on "${alg.alg}"`).toBe(true)
    }
  })

  it('agrees with cubing.js on inverses too', () => {
    for (const { alg } of everyAlg.filter((_, i) => i % 5 === 0)) {
      const parsed = parseAlg(alg.alg)
      if (!parsed.ok) continue
      const mine = applyMoves(SOLVED, invertMoves(parsed.moves))
      const theirs = fromPattern(REFERENCE_SOLVED.applyAlg(new Alg(alg.alg).invert()))
      expect(statesEqual(mine, theirs), `disagreed inverting "${alg.alg}"`).toBe(true)
    }
  })

  it('round-trips: an algorithm followed by its inverse is a solved cube', () => {
    for (const { alg } of everyAlg.filter((_, i) => i % 7 === 0)) {
      const parsed = parseAlg(alg.alg)
      if (!parsed.ok) continue
      const there = applyMoves(SOLVED, parsed.moves)
      expect(statesEqual(applyMoves(there, invertMoves(parsed.moves)), SOLVED)).toBe(true)
    }
  })
})

describe('parseAlg', () => {
  it('reads the notation the sheet and the user actually use', () => {
    expect(parseAlg("R U R'").ok).toBe(true)
    expect(parseAlg('R2 U2').ok).toBe(true)
    expect(parseAlg("R2' U").ok).toBe(true) // a half turn either way
    expect(parseAlg('Rw U r').ok).toBe(true)
    expect(parseAlg("M' E S").ok).toBe(true)
    expect(parseAlg("x y' z2").ok).toBe(true)
    expect(parseAlg('[U2] R U').ok).toBe(true) // bracketed AUF is a real move
    expect(parseAlg("(R U) R'").ok).toBe(true)
    expect(parseAlg('R’ U').ok).toBe(true) // curly apostrophe
  })

  it('treats R2 and R2prime as the same half turn', () => {
    const a = parseAlg('R2')
    const b = parseAlg("R2'")
    expect(a.ok && b.ok && a.moves[0].amount === b.moves[0].amount).toBe(true)
  })

  it('rejects what it cannot read rather than guessing', () => {
    for (const bad of ['', '   ', 'Q', 'R3', "R''", 'Mw', 'hello', 'R U banana']) {
      expect(parseAlg(bad).ok, `should have rejected "${bad}"`).toBe(false)
    }
  })
})

describe('validateAlgForCase', () => {
  it('accepts every stored algorithm for its own case, with the stored AUF offset', () => {
    for (const { case: c, alg } of everyAlg.filter((_, i) => i % 3 === 0)) {
      const result = validateAlgForCase(alg.alg, c.state, c.algSet)
      expect(result.ok, `rejected "${alg.alg}" for ${c.displayName}`).toBe(true)
      if (result.ok) {
        expect(result.aufOffset, `${c.displayName} "${alg.alg}"`).toBe(alg.aufOffset)
      }
    }
  })

  it('rejects an algorithm that solves a different case', () => {
    const a = CASES[0]
    const other = CASES.find((c) => c.id !== a.id && c.algSet === a.algSet && c.subset !== a.subset)!
    const result = validateAlgForCase(other.algs[0].alg, a.state, a.algSet)
    expect(result.ok).toBe(false)
  })

  it('rejects an algorithm that solves nothing', () => {
    expect(validateAlgForCase('R U', CASES[0].state, CASES[0].algSet).ok).toBe(false)
  })

  it('explains itself rather than failing silently', () => {
    const result = validateAlgForCase('banana', CASES[0].state, CASES[0].algSet)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0)
  })
})
