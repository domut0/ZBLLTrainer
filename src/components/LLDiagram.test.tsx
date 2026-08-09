import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LLDiagram } from './LLDiagram'
import { CASES } from '../data'
import { FACELET_FILL } from '../data/types'

const SOLVED = 'Y'.repeat(9) + 'BBB' + 'OOO' + 'GGG' + 'RRR'

function rects(container: HTMLElement): SVGRectElement[] {
  return Array.from(container.querySelectorAll('rect'))
}

function rectAt(container: HTMLElement, index: number): SVGRectElement {
  const found = container.querySelector<SVGRectElement>(`rect[data-index="${index}"]`)
  if (!found) throw new Error(`no sticker rendered for index ${index}`)
  return found
}

function boxOf(rect: SVGRectElement) {
  return {
    x: Number(rect.getAttribute('x')),
    y: Number(rect.getAttribute('y')),
    width: Number(rect.getAttribute('width')),
    height: Number(rect.getAttribute('height')),
  }
}

/**
 * The layout the diagram must keep, written out longhand rather than imported
 * from the component — a test that recomputes the geometry from the same
 * constants would follow a layout regression instead of catching it.
 *
 * Derived from data/SCHEMA.md § FaceletString: 0-8 U face row-major, 9-11 the
 * bar above, 12-14 right, 15-17 below, 18-20 left.
 */
const EXPECTED_BOXES: Record<number, { x: number; y: number; width: number; height: number }> = {
  // U face, back row first, left column first.
  0: { x: 70, y: 70, width: 100, height: 100 },
  1: { x: 180, y: 70, width: 100, height: 100 },
  2: { x: 290, y: 70, width: 100, height: 100 },
  3: { x: 70, y: 180, width: 100, height: 100 },
  4: { x: 180, y: 180, width: 100, height: 100 },
  5: { x: 290, y: 180, width: 100, height: 100 },
  6: { x: 70, y: 290, width: 100, height: 100 },
  7: { x: 180, y: 290, width: 100, height: 100 },
  8: { x: 290, y: 290, width: 100, height: 100 },
  // B bar, above the square, left to right.
  9: { x: 70, y: 8, width: 100, height: 40 },
  10: { x: 180, y: 8, width: 100, height: 40 },
  11: { x: 290, y: 8, width: 100, height: 40 },
  // R bar, right of the square, top to bottom.
  12: { x: 412, y: 70, width: 40, height: 100 },
  13: { x: 412, y: 180, width: 40, height: 100 },
  14: { x: 412, y: 290, width: 40, height: 100 },
  // F bar, below the square, left to right.
  15: { x: 70, y: 412, width: 100, height: 40 },
  16: { x: 180, y: 412, width: 100, height: 40 },
  17: { x: 290, y: 412, width: 100, height: 40 },
  // L bar, left of the square, top to bottom.
  18: { x: 8, y: 70, width: 40, height: 100 },
  19: { x: 8, y: 180, width: 40, height: 100 },
  20: { x: 8, y: 290, width: 40, height: 100 },
}

/** A case picked by name so it survives any reordering of cases.json. */
const SAMPLE_CASE = CASES.find((c) => c.displayName === 'As1: 2GLL #1')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LLDiagram', () => {
  it('draws all 21 stickers', () => {
    const { container } = render(<LLDiagram facelets={SOLVED} />)
    expect(rects(container)).toHaveLength(21)
  })

  it('is an accessible image that scales from its viewBox alone', () => {
    const { container } = render(<LLDiagram facelets={SOLVED} />)
    const svg = container.querySelector('svg')!

    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Last layer diagram')
    expect(svg.querySelector('title')?.textContent).toBe('Last layer diagram')
    // The parent sizes it, so the SVG itself must not.
    expect(svg.getAttribute('viewBox')).toBe('0 0 460 460')
    expect(svg.getAttribute('width')).toBeNull()
    expect(svg.getAttribute('height')).toBeNull()
  })

  it('passes className through for the parent to size it', () => {
    const { container } = render(<LLDiagram facelets={SOLVED} className="w-16 h-16" />)
    expect(container.querySelector('svg')).toHaveClass('w-16', 'h-16')
  })

  it('accepts an overridden accessible name', () => {
    const { container } = render(<LLDiagram facelets={SOLVED} label="As1: 2GLL #1" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('aria-label')).toBe('As1: 2GLL #1')
    expect(svg.querySelector('title')?.textContent).toBe('As1: 2GLL #1')
  })

  it('renders a solved last layer as a yellow face and one colour per bar', () => {
    const { container } = render(<LLDiagram facelets={SOLVED} />)

    for (let i = 0; i < 9; i += 1) {
      expect(rectAt(container, i).getAttribute('fill'), `index ${i}`).toBe(FACELET_FILL.Y)
    }
    // B bar behind, R bar (orange) right, F bar (green) front, L bar (red) left.
    for (const i of [9, 10, 11]) {
      expect(rectAt(container, i).getAttribute('fill'), `index ${i}`).toBe(FACELET_FILL.B)
    }
    for (const i of [12, 13, 14]) {
      expect(rectAt(container, i).getAttribute('fill'), `index ${i}`).toBe(FACELET_FILL.O)
    }
    for (const i of [15, 16, 17]) {
      expect(rectAt(container, i).getAttribute('fill'), `index ${i}`).toBe(FACELET_FILL.G)
    }
    for (const i of [18, 19, 20]) {
      expect(rectAt(container, i).getAttribute('fill'), `index ${i}`).toBe(FACELET_FILL.R)
    }
  })

  // W never occurs in real data (data/SCHEMA.md), which makes it a clean marker:
  // exactly one sticker is white, and it has to land where the layout says.
  describe.each(Object.keys(EXPECTED_BOXES).map(Number))('index %i', (index) => {
    it('is the only white sticker and sits at its documented box', () => {
      const chars = 'Y'.repeat(21).split('')
      chars[index] = 'W'
      const { container } = render(<LLDiagram facelets={chars.join('')} />)

      const white = rects(container).filter((r) => r.getAttribute('fill') === FACELET_FILL.W)
      expect(white).toHaveLength(1)
      expect(white[0].getAttribute('data-index')).toBe(String(index))
      expect(boxOf(white[0])).toEqual(EXPECTED_BOXES[index])
    })
  })

  it('gives every index a distinct box', () => {
    const { container } = render(<LLDiagram facelets={SOLVED} />)
    const boxes = rects(container).map((r) => JSON.stringify(boxOf(r)))
    expect(new Set(boxes).size).toBe(21)
  })

  it('is deterministic: the same string renders identical markup', () => {
    const a = render(<LLDiagram facelets={SOLVED} />).container.innerHTML
    const b = render(<LLDiagram facelets={SOLVED} />).container.innerHTML
    expect(a).toBe(b)
  })

  it('renders all four AUFs of a real case, each one different', () => {
    expect(SAMPLE_CASE).toBeDefined()
    const markup = SAMPLE_CASE!.facelets.map(
      (f) => render(<LLDiagram facelets={f} />).container.innerHTML,
    )
    expect(markup).toHaveLength(4)
    expect(new Set(markup).size).toBe(4)
  })

  it('matches the snapshot for a real case', () => {
    expect(SAMPLE_CASE).toBeDefined()
    const { container } = render(<LLDiagram facelets={SAMPLE_CASE!.facelets[0]} />)
    expect(container.innerHTML).toMatchSnapshot()
  })

  describe('malformed input', () => {
    it.each([
      ['too short', 'YYY'],
      ['too long', SOLVED + 'Y'],
      ['unknown letter', 'Z' + SOLVED.slice(1)],
      ['empty', ''],
    ])('throws in development on a %s string', (_why, facelets) => {
      // React logs the thrown error itself; keep the suite output readable.
      vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => render(<LLDiagram facelets={facelets} />)).toThrow(/malformed facelet string/)
    })
  })
})
