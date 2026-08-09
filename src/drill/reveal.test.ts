import { describe, expect, it } from 'vitest'
import { Alg } from 'cubing/alg'
import { cube3x3x3 } from 'cubing/puzzles'
import { CASES, SCRAMBLES } from '@/data'
import type { Auf } from '@/data/types'
import { revealAlgorithm } from './reveal'

// Issue 07's acceptance criterion, in the form it asks for: asserted, not
// eyeballed. The revealed algorithm applied to the served scramble must solve
// the cube. cubing.js is a build/test dependency only — nothing here is
// imported by the app, so no solver reaches the client bundle.

const kpuzzle = await cube3x3x3.kpuzzle()
const SOLVED = kpuzzle.defaultPattern()

// Algorithms containing a rotation, or a wide move that carries one, leave the
// cube solved but turned in the hands. That still counts as solved.
const ROTATIONS: string[] = []
for (const a of ['', 'x', 'x2', "x'", 'z', "z'"]) {
  for (const b of ['', 'y', 'y2', "y'"]) ROTATIONS.push(`${a} ${b}`.trim())
}
const SOLVED_STATES = new Set(
  ROTATIONS.map((r) => JSON.stringify(SOLVED.applyAlg(new Alg(r)).patternData)),
)

const isSolved = (patternJson: string) => SOLVED_STATES.has(patternJson)

/**
 * COLL is solved when the corners are home and edge orientation survived. Edge
 * PERMUTATION is deliberately not checked — leaving it free is the definition
 * of the set.
 *
 * The rotation has to be undone for the WHOLE state, not just the corners.
 * Allowing a rotated corner arrangement while demanding the F2L edges sit at
 * their unrotated indices is a predicate no cube can satisfy once an algorithm
 * carries a `y`, and 5 of the borrowed algorithms do.
 */
function collSolvedInFrame(pd: any) {
  const c = pd.CORNERS
  const e = pd.EDGES
  return (
    c.pieces.every((v: number, i: number) => v === i) &&
    c.orientation.every((v: number) => v === 0) &&
    e.pieces.slice(4).every((v: number, i: number) => v === i + 4) &&
    e.orientation.every((v: number) => v === 0)
  )
}

const ROTATION_ALGS = ROTATIONS.map((r) => new Alg(r))

function isCollSolved(pd: any) {
  const p = new (SOLVED.constructor as any)(kpuzzle, pd)
  return ROTATION_ALGS.some((r) => collSolvedInFrame(p.applyAlg(r).patternData))
}

function lxsSolvedInFrame(pd: any) {
  const c = pd.CORNERS
  const e = pd.EDGES
  for (let i = 4; i <= 7; i++) {
    if (c.pieces[i] !== i || c.orientation[i] !== 0) return false
  }
  for (const i of [4, 5, 6, 7, 8, 9, 10, 11]) {
    if (e.pieces[i] !== i || e.orientation[i] !== 0) return false
  }
  return true
}

function isLxsSolved(pd: any) {
  const p = new (SOLVED.constructor as any)(kpuzzle, pd)
  return ROTATION_ALGS.some((r) => lxsSolvedInFrame(p.applyAlg(r).patternData))
}

function eoSolvedInFrame(pd: any) {
  const c = pd.CORNERS
  const e = pd.EDGES
  for (let i = 5; i <= 7; i++) {
    if (c.pieces[i] !== i || c.orientation[i] !== 0) return false
  }
  for (const i of [4, 6, 9, 10, 11]) {
    if (e.pieces[i] !== i || e.orientation[i] !== 0) return false
  }
  return e.orientation.every((v: number) => v === 0)
}

function isEoSolved(pd: any) {
  const p = new (SOLVED.constructor as any)(kpuzzle, pd)
  return ROTATION_ALGS.some((r) => eoSolvedInFrame(p.applyAlg(r).patternData))
}

function checkSolvedForAlgSet(pd: any, algSet: string): boolean {
  if (algSet === 'COLL') return isCollSolved(pd)
  if (algSet === 'LXS') return isLxsSolved(pd)
  if (algSet === 'EO') return isEoSolved(pd)
  return isSolved(JSON.stringify(pd))
}

const applyAllPattern = (scramble: string, reveal: string) =>
  SOLVED.applyAlg(new Alg(scramble)).applyAlg(new Alg(reveal)).patternData

// A spread across all seven ZBLL subsets — plus EVERY COLL case and EVERY EO case.
const sample = [
  ...CASES.filter((c, i) => c.algSet === 'ZBLL' && i % 7 === 0),
  ...CASES.filter((c) => c.algSet === 'COLL'),
  ...CASES.filter((c, i) => c.algSet === 'LXS' && i % 5 === 0),
  ...CASES.filter((c) => c.algSet === 'EO'),
]

// scrambles.json is generated grouped by AUF — the first five entries of every
// case are all auf 0. Taking the first N therefore tests only the orientation
// that needs no correction, which is precisely the case that passes whether or
// not the correction works. Pick one scramble per AUF instead.
const acrossAufs = (caseId: string) => {
  const list = SCRAMBLES[caseId] ?? []
  return ([0, 1, 2, 3] as Auf[])
    .map((auf) => list.find((s) => s.auf === auf))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
}

describe('revealAlgorithm', () => {
  it('covers every subset in the sample', () => {
    const zbllSample = sample.filter((c) => c.algSet === 'ZBLL')
    expect(new Set(zbllSample.map((c) => c.subset)).size).toBe(7)
  })

  it('exercises all four AUFs, not just the uncorrected one', () => {
    for (const c of sample) {
      expect(acrossAufs(c.id).map((s) => s.auf), c.displayName).toEqual([0, 1, 2, 3])
    }
  })

  it('solves the served scramble, for every case, algorithm and AUF in the sample', () => {
    let checked = 0
    for (const c of sample) {
      for (const s of acrossAufs(c.id)) {
        for (const a of c.algs) {
          const reveal = revealAlgorithm(a, s.auf)
          const resultPattern = applyAllPattern(s.scramble, reveal)
          expect(
            checkSolvedForAlgSet(resultPattern, c.algSet),
            `${c.displayName} auf=${s.auf} offset=${a.aufOffset}\n  scramble: ${s.scramble}\n  reveal:   ${reveal}`,
          ).toBe(true)
          checked++
        }
      }
    }
    expect(checked).toBeGreaterThan(400)
  })

  // Negative controls. Without these the test above would still pass if
  // revealAlgorithm silently stopped correcting anything, which is exactly the
  // bug this file exists to prevent.
  it('fails if the pre-AUF for the served orientation is dropped', () => {
    let anyFailed = false
    for (const c of sample) {
      for (const s of acrossAufs(c.id)) {
        for (const a of c.algs) {
          if (s.auf === 0) continue
          const withoutPre = revealAlgorithm(a, 0 as Auf)
          const resultPattern = applyAllPattern(s.scramble, withoutPre)
          const solved = checkSolvedForAlgSet(resultPattern, c.algSet)
          if (!solved) anyFailed = true
        }
      }
    }
    expect(anyFailed).toBe(true)
  })

  it('fails if the trailing AUF the spreadsheet omitted is dropped', () => {
    let anyFailed = false
    for (const c of sample) {
      for (const s of acrossAufs(c.id)) {
        for (const a of c.algs) {
          if (a.aufOffset === 0) continue
          const withoutPost = revealAlgorithm({ ...a, aufOffset: 0 }, s.auf)
          const resultPattern = applyAllPattern(s.scramble, withoutPost)
          const solved = checkSolvedForAlgSet(resultPattern, c.algSet)
          if (!solved) anyFailed = true
        }
      }
    }
    expect(anyFailed).toBe(true)
  })

  it('leaves an already-canonical algorithm alone', () => {
    expect(revealAlgorithm({ alg: "R U R'", aufOffset: 0 }, 0)).toBe("R U R'")
  })

  it('correctly reveals and solves LXS cases containing wide/slice moves across all AUFs', () => {
    const wideCase = CASES.find(
      (c) => c.algSet === 'LXS' && c.algs.some((a) => /\b[rfMSu]\b/.test(a.alg)),
    )
    expect(wideCase, 'found LXS case containing wide/slice move').toBeDefined()
    for (const s of acrossAufs(wideCase!.id)) {
      for (const a of wideCase!.algs) {
        const reveal = revealAlgorithm(a, s.auf)
        const resultPattern = applyAllPattern(s.scramble, reveal)
        expect(
          isLxsSolved(resultPattern),
          `wide-alg case ${wideCase!.displayName} auf=${s.auf} offset=${a.aufOffset}\n  scramble: ${s.scramble}\n  reveal: ${reveal}`,
        ).toBe(true)
      }
    }
  })

  it('prepends the inverse of the served AUF', () => {
    expect(revealAlgorithm({ alg: "R U R'", aufOffset: 0 }, 1)).toBe("U' R U R'")
    expect(revealAlgorithm({ alg: "R U R'", aufOffset: 0 }, 2)).toBe("U2 R U R'")
    expect(revealAlgorithm({ alg: "R U R'", aufOffset: 0 }, 3)).toBe("U R U R'")
  })

  it('appends the inverse of the stored offset', () => {
    expect(revealAlgorithm({ alg: "R U R'", aufOffset: 1 }, 0)).toBe("R U R' U'")
    expect(revealAlgorithm({ alg: "R U R'", aufOffset: 3 }, 0)).toBe("R U R' U")
  })
})
