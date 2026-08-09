import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StageDiagram } from './StageDiagram'
import { CASES } from '../data'
import { FACELET_FILL } from '../data/types'

const SOLVED = 'Y'.repeat(9) + 'BBB' + 'OOO' + 'GGG' + 'RRR' + 'GOGOWOW'

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

const EXPECTED_SLOT_BOXES: Record<number, { x: number; y: number; width: number; height: number }> = {
  21: { x: 290, y: 474, width: 100, height: 40 },
  22: { x: 412, y: 474, width: 40, height: 40 },
  23: { x: 290, y: 524, width: 100, height: 40 },
  24: { x: 412, y: 524, width: 40, height: 40 },
  25: { x: 290, y: 574, width: 100, height: 40 },
  26: { x: 462, y: 524, width: 40, height: 40 },
  27: { x: 412, y: 574, width: 40, height: 40 },
}

const SAMPLE_LXS_CASE = CASES.find((c) => c.algSet === 'LXS')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('StageDiagram', () => {
  it('draws all 28 stickers (21 LL + 7 slot)', () => {
    const { container } = render(<StageDiagram facelets={SOLVED} />)
    expect(rects(container)).toHaveLength(28)
  })

  it('is an accessible image with viewBox 0 0 622 622', () => {
    const { container } = render(<StageDiagram facelets={SOLVED} />)
    const svg = container.querySelector('svg')!

    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('Stage diagram')
    expect(svg.querySelector('title')?.textContent).toBe('Stage diagram')
    expect(svg.getAttribute('viewBox')).toBe('0 0 622 622')
    expect(svg.getAttribute('width')).toBeNull()
    expect(svg.getAttribute('height')).toBeNull()
  })

  it('passes className through for parent sizing', () => {
    const { container } = render(<StageDiagram facelets={SOLVED} className="w-20 h-20" />)
    expect(container.querySelector('svg')).toHaveClass('w-20', 'h-20')
  })

  it('renders a solved stage diagram with expected fills', () => {
    const { container } = render(<StageDiagram facelets={SOLVED} />)

    for (let i = 0; i < 9; i += 1) {
      expect(rectAt(container, i).getAttribute('fill'), `index ${i}`).toBe(FACELET_FILL.Y)
    }
    // Slot stickers
    expect(rectAt(container, 21).getAttribute('fill')).toBe(FACELET_FILL.G)
    expect(rectAt(container, 22).getAttribute('fill')).toBe(FACELET_FILL.O)
    expect(rectAt(container, 23).getAttribute('fill')).toBe(FACELET_FILL.G)
    expect(rectAt(container, 24).getAttribute('fill')).toBe(FACELET_FILL.O)
    expect(rectAt(container, 25).getAttribute('fill')).toBe(FACELET_FILL.W)
    expect(rectAt(container, 26).getAttribute('fill')).toBe(FACELET_FILL.O)
    expect(rectAt(container, 27).getAttribute('fill')).toBe(FACELET_FILL.W)
  })

  describe.each(Object.keys(EXPECTED_SLOT_BOXES).map(Number))('slot index %i', (index) => {
    it('sits at its documented box', () => {
      const { container } = render(<StageDiagram facelets={SOLVED} />)
      const rect = rectAt(container, index)
      expect(boxOf(rect)).toEqual(EXPECTED_SLOT_BOXES[index])
    })
  })

  it('gives every index a distinct box', () => {
    const { container } = render(<StageDiagram facelets={SOLVED} />)
    const boxes = rects(container).map((r) => JSON.stringify(boxOf(r)))
    expect(new Set(boxes).size).toBe(28)
  })

  it('renders a real LXS case across four AUFs', () => {
    expect(SAMPLE_LXS_CASE).toBeDefined()
    const markup = SAMPLE_LXS_CASE!.facelets.map(
      (f) => render(<StageDiagram facelets={f} />).container.innerHTML,
    )
    expect(markup).toHaveLength(4)
    expect(new Set(markup).size).toBe(4)
  })

  describe('malformed input', () => {
    it.each([
      ['too short', 'Y'.repeat(21)],
      ['too long', 'Y'.repeat(29)],
      ['unknown letter', 'Z' + SOLVED.slice(1)],
      ['empty', ''],
    ])('throws in development on a %s string', (_why, facelets) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => render(<StageDiagram facelets={facelets} />)).toThrow(/malformed facelet string/)
    })
  })
})
