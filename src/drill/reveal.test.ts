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

const applyAll = (scramble: string, reveal: string) =>
  JSON.stringify(SOLVED.applyAlg(new Alg(scramble)).applyAlg(new Alg(reveal)).patternData)

// A spread across all seven sets rather than the first N, which would all be AS.
const sample = CASES.filter((_, i) => i % 7 === 0)

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
  it('covers every set in the sample', () => {
    expect(new Set(sample.map((c) => c.set)).size).toBe(7)
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
          expect(
            isSolved(applyAll(s.scramble, reveal)),
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
          if (!isSolved(applyAll(s.scramble, withoutPre))) anyFailed = true
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
          if (!isSolved(applyAll(s.scramble, withoutPost))) anyFailed = true
        }
      }
    }
    expect(anyFailed).toBe(true)
  })

  it('leaves an already-canonical algorithm alone', () => {
    expect(revealAlgorithm({ alg: "R U R'", aufOffset: 0 }, 0)).toBe("R U R'")
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
