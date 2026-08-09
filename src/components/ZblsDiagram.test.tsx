import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ZblsDiagram } from './ZblsDiagram'
import { CASES } from '../data'

const ZBLS = CASES.filter((c) => c.algSet === 'ZBLS')

/** Facelet indices of the four last-layer edge positions, U face. */
const LL_EDGES = [1, 3, 5, 7]

const marks = (c: HTMLElement) => c.querySelectorAll('[data-misoriented]').length

describe('ZblsDiagram', () => {
  it('has ZBLS cases to draw', () => {
    expect(ZBLS.length).toBe(302)
  })

  /**
   * The bug this exists to prevent.
   *
   * The marker used to be derived from the sticker colour — anything not yellow
   * or white counted as misoriented. That is wrong whenever the FR/DR slot edge
   * is parked in the last layer: it is correctly oriented and still shows a side
   * colour, so it was flagged on 480 of the 1208 diagrams. Orientation is not a
   * colour; it now comes from the cube state as a '1' in the facelet string.
   */
  it('marks exactly the positions the facelet string calls misoriented', () => {
    for (const c of ZBLS) {
      for (const f of c.facelets) {
        const { container } = render(<ZblsDiagram facelets={f} />)
        const expected = LL_EDGES.filter((i) => f[i] === '1').length
        expect(marks(container), `${c.displayName}: ${f}`).toBe(expected)
      }
    }
  })

  it('draws no marker for a case with every last-layer edge oriented', () => {
    const allOriented = ZBLS.find((c) => c.facelets[0].split('').filter((ch) => ch === '1').length === 0)
    if (!allOriented) return
    const { container } = render(<ZblsDiagram facelets={allOriented.facelets[0]} />)
    expect(marks(container)).toBe(0)
  })

  // A side colour on a last-layer edge position must not, by itself, produce a
  // marker — that was the old rule, and it is the one that was wrong.
  it('does not mark a coloured last-layer edge position', () => {
    const withColour = ZBLS.find((c) =>
      LL_EDGES.some((i) => !['0', '1', '?'].includes(c.facelets[0][i])),
    )
    if (!withColour) return
    const f = withColour.facelets[0]
    const { container } = render(<ZblsDiagram facelets={f} />)
    expect(marks(container)).toBe(LL_EDGES.filter((i) => f[i] === '1').length)
  })
})
