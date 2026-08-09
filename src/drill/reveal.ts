import type { Auf, CaseAlg } from '@/data/types'

/**
 * The AUF trap, and why this file exists.
 *
 * Every case is served at a random AUF (PRD §4). The algorithms in the source
 * spreadsheet are written for one specific orientation, and the spreadsheet
 * omits the trailing AUF entirely — the importer recovered it and stored it as
 * `aufOffset`. So the stored string is wrong twice over for a case served at a
 * random angle, and printing it verbatim shows an algorithm that does not solve
 * the cube in the user's hands.
 *
 * Writing X.Y for "do X then Y", and treating a pattern as the transformation
 * that produces it from solved, the importer built the case as
 *
 *     C = U^offset . alg^-1        so     C^-1 = alg . U^-offset
 *
 * A scramble tagged `auf: k` leaves the cube at C . U^k, so the sequence that
 * solves it is
 *
 *     (C . U^k)^-1 = U^-k . C^-1 = U^-k . alg . U^-offset
 *
 * A pre-AUF for the orientation served, and a post-AUF for the one the
 * spreadsheet dropped. Verified against all 472 cases in
 * scripts/spike6-auf-reveal.mjs and asserted in reveal.test.ts, including
 * negative controls — dropping either AUF makes thousands of cases fail.
 */

const AUF_MOVES = ['', 'U', 'U2', "U'"] as const

/** The inverse of an AUF, as an index. */
const invertAuf = (auf: Auf): Auf => ((4 - auf) % 4) as Auf

/**
 * The algorithm to show the user for `alg` when the case was served at
 * `servedAuf`. Applying this to the scrambled cube solves it.
 */
export function revealAlgorithm(alg: CaseAlg, servedAuf: Auf): string {
  return [AUF_MOVES[invertAuf(servedAuf)], alg.alg, AUF_MOVES[invertAuf(alg.aufOffset)]]
    .filter(Boolean)
    .join(' ')
}

/**
 * The same, split up, for callers that want to show the corrections distinctly
 * from the algorithm the user learned.
 */
export function revealParts(alg: CaseAlg, servedAuf: Auf): {
  preAuf: string
  core: string
  postAuf: string
} {
  return {
    preAuf: AUF_MOVES[invertAuf(servedAuf)],
    core: alg.alg,
    postAuf: AUF_MOVES[invertAuf(alg.aufOffset)],
  }
}
