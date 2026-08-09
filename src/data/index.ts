import casesJson from '@data/cases.json'
import scramblesJson from '@data/scrambles.json'
import type { ScramblesByCaseId, ZbllCase } from './types'

// Imported rather than fetched so vite-plugin-pwa precaches them along with the
// bundle. The app has to work with no network at all (PRD §8).
export const CASES = casesJson as unknown as ZbllCase[]
export const SCRAMBLES = scramblesJson as unknown as ScramblesByCaseId

export const CASES_BY_ID: ReadonlyMap<string, ZbllCase> = new Map(
  CASES.map((c) => [c.id, c]),
)

export * from './types'
