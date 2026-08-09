import { describe, expect, it } from 'vitest'
import { CASES, CASES_BY_ID, SCRAMBLES } from './index'
import { FACELET_COUNT, U_CENTRE_INDEX } from './types'

// The build scripts already assert all of this (scripts/verify-facelets.mjs).
// Repeating a thin slice here catches the other failure: shipping a stale or
// half-regenerated data/cases.json into the app.
describe('case data', () => {
  it('has all 628 cases with unique ids', () => {
    expect(CASES).toHaveLength(628)
    expect(CASES_BY_ID.size).toBe(628)
  })

  it('gives every case four diagrams of valid sticker length', () => {
    for (const c of CASES) {
      expect(c.facelets, c.displayName).toHaveLength(4)
      const expectedLen = c.algSet === 'LXS' ? 28 : FACELET_COUNT
      for (const f of c.facelets) expect(f, c.displayName).toHaveLength(expectedLen)
    }
  })

  it('never shows the bottom colour for LL sets, and always shows an oriented last layer', () => {
    for (const c of CASES) {
      for (const f of c.facelets) {
        if (c.algSet === 'ZBLL') {
          expect(f, `${c.displayName}: ${f}`).not.toContain('W')
          for (const i of [1, 3, 5, 7, U_CENTRE_INDEX]) {
            expect(f[i], `${c.displayName} index ${i}`).toBe('Y')
          }
        } else if (c.algSet === 'COLL') {
          expect(f, `${c.displayName}: ${f}`).not.toContain('W')
          for (const i of [1, 3, 5, 7]) {
            expect(f[i], `${c.displayName} index ${i}`).toBe('?')
          }
          expect(f[U_CENTRE_INDEX], `${c.displayName} index ${U_CENTRE_INDEX}`).toBe('Y')
        } else if (c.algSet === 'LXS') {
          expect(f[U_CENTRE_INDEX], `${c.displayName} index ${U_CENTRE_INDEX}`).toBe('Y')
        }
      }
    }
  })

  it('has scrambles for every case, tagged with an auf in range', () => {
    for (const c of CASES) {
      const list = SCRAMBLES[c.id]
      expect(list, c.displayName).toBeDefined()
      expect(list.length, c.displayName).toBeGreaterThan(0)
      for (const s of list) expect([0, 1, 2, 3]).toContain(s.auf)
    }
  })

  it('gives every case at least one algorithm', () => {
    for (const c of CASES) expect(c.algs.length, c.displayName).toBeGreaterThan(0)
  })

  // Browse keys its per-group ticked counts by the group label alone. That is
  // only safe while no two sets share a label — otherwise their counts silently
  // merge, which looks like a UI bug and is really a data one.
  it('never reuses a group label across two subsets within the same set', () => {
    const setsByGroup = new Map<string, Set<string>>()
    for (const c of CASES) {
      const key = `${c.algSet}:${c.group}`
      const seen = setsByGroup.get(key) ?? new Set<string>()
      seen.add(c.subset)
      setsByGroup.set(key, seen)
    }
    const shared = [...setsByGroup].filter(([, sets]) => sets.size > 1)
    expect(shared.map(([g]) => g)).toEqual([])
  })
})
