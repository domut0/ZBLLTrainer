import { describe, expect, it } from 'vitest'
import { CASES, CASES_BY_ID, SCRAMBLES } from './index'
import { FACELET_COUNT, U_CENTRE_INDEX } from './types'

// The build scripts already assert all of this (scripts/verify-facelets.mjs).
// Repeating a thin slice here catches the other failure: shipping a stale or
// half-regenerated data/cases.json into the app.
describe('case data', () => {
  it('has all 472 cases with unique ids', () => {
    expect(CASES).toHaveLength(472)
    expect(CASES_BY_ID.size).toBe(472)
  })

  it('gives every case four diagrams of 21 stickers', () => {
    for (const c of CASES) {
      expect(c.facelets, c.displayName).toHaveLength(4)
      for (const f of c.facelets) expect(f, c.displayName).toHaveLength(FACELET_COUNT)
    }
  })

  it('never shows the bottom colour, and always shows an oriented last layer', () => {
    for (const c of CASES) {
      for (const f of c.facelets) {
        expect(f, `${c.displayName}: ${f}`).not.toContain('W')
        // Every last-layer edge is oriented in ZBLL, so these are always yellow.
        for (const i of [1, 3, 5, 7, U_CENTRE_INDEX]) {
          expect(f[i], `${c.displayName} index ${i}`).toBe('Y')
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
})
