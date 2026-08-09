import casesJson from '@data/cases.json'
import scramblesJson from '@data/scrambles.json'
import type { AlgSetId, CaseSubset, ScramblesByCaseId, TrainerCase } from './types'

// Imported rather than fetched so vite-plugin-pwa precaches them along with the
// bundle. The app has to work with no network at all (PRD §8).
export const CASES = casesJson as unknown as TrainerCase[]
export const SCRAMBLES = scramblesJson as unknown as ScramblesByCaseId

export const CASES_BY_ID: ReadonlyMap<string, TrainerCase> = new Map(
  CASES.map((c) => [c.id, c]),
)

/**
 * Cases bucketed by algorithm set, built once at module load.
 *
 * Views used to filter the flat `CASES` array on every render, which was fine
 * while ZBLL was the only set. With several sets, every screen wants "the cases
 * in the set I am looking at" as its starting point, so it is worth having.
 * Insertion order within a bucket is source-sheet order, as before.
 */
export const CASES_BY_ALG_SET: ReadonlyMap<AlgSetId, readonly TrainerCase[]> = (() => {
  const out = new Map<AlgSetId, TrainerCase[]>()
  for (const c of CASES) {
    const bucket = out.get(c.algSet)
    if (bucket) bucket.push(c)
    else out.set(c.algSet, [c])
  }
  return out
})()

export const casesInAlgSet = (algSet: AlgSetId): readonly TrainerCase[] =>
  CASES_BY_ALG_SET.get(algSet) ?? []

export const casesInSubset = (
  algSet: AlgSetId,
  subset: CaseSubset,
): readonly TrainerCase[] => casesInAlgSet(algSet).filter((c) => c.subset === subset)

/**
 * Group labels within a subset, in source-sheet order. Sheet order is the order
 * the groups are taught in, so it is deliberately not sorted.
 */
export function groupsInSubset(algSet: AlgSetId, subset: CaseSubset): string[] {
  const seen: string[] = []
  for (const c of casesInSubset(algSet, subset)) {
    if (!seen.includes(c.group)) seen.push(c.group)
  }
  return seen
}

/** Every group label in a set, in source-sheet order. Backs the drill's group filter. */
export function groupsInAlgSet(algSet: AlgSetId): string[] {
  const seen: string[] = []
  for (const c of casesInAlgSet(algSet)) {
    if (!seen.includes(c.group)) seen.push(c.group)
  }
  return seen
}

export * from './types'
export * from './algSets'
