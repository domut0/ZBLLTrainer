import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EoDiagram } from './EoDiagram'
import { CASES } from '../data'
import { FACELET_FILL } from '../data/types'

// 28 stickers: 16 '?' and 12 marked '0' (oriented) or '1' (misoriented)
const ALL_ORIENTED = '?' + '0' + '?' + '0' + '?' + '0' + '?' + '0' + '?' + '?' + '0' + '?' + '0' + '?' + '?' + '?' + '0' + '?' + '0' + '?' + '?' + '0' + '0' + '?' + '?' + '?' + '0' + '0'

const SAMPLE_EO_CASE = CASES.find((c) => c.algSet === 'EO')

function rectAt(container: HTMLElement, index: number): SVGRectElement {
  const found = container.querySelector<SVGRectElement>(`rect[data-index="${index}"]`)
  if (!found) throw new Error(`no sticker rendered for index ${index}`)
  return found
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EoDiagram', () => {
  it('draws all 28 stickers (21 LL + 7 slot)', () => {
    const { container } = render(<EoDiagram facelets={ALL_ORIENTED} />)
    expect(container.querySelectorAll('rect')).toHaveLength(28)
  })

  it('is an accessible image with viewBox 0 0 622 622', () => {
    const { container } = render(<EoDiagram facelets={ALL_ORIENTED} />)
    const svg = container.querySelector('svg')!

    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toBe('EO diagram')
    expect(svg.querySelector('title')?.textContent).toBe('EO diagram')
    expect(svg.getAttribute('viewBox')).toBe('0 0 622 622')
  })

  it('renders a misoriented edge and an oriented edge differently', () => {
    // Both edges would present the same top sticker colour on a real cube if derived by colour,
    // but EO diagrams render edge orientation explicitly.
    const orientedFacelets = ALL_ORIENTED
    // Swap UF edge (index 7 and 16) to misoriented ('1')
    const chars = [...ALL_ORIENTED]
    chars[7] = '1'
    chars[16] = '1'
    const misorientedFacelets = chars.join('')

    const { container: orientedContainer } = render(<EoDiagram facelets={orientedFacelets} />)
    const { container: misorientedContainer } = render(<EoDiagram facelets={misorientedFacelets} />)

    const orientedUF = rectAt(orientedContainer, 7)
    const misorientedUF = rectAt(misorientedContainer, 7)

    // Fill colors must be different (green '0' vs red '1')
    expect(orientedUF.getAttribute('fill')).toBe(FACELET_FILL['0'])
    expect(misorientedUF.getAttribute('fill')).toBe(FACELET_FILL['1'])

    // Misoriented edge must also render a flip marker element
    expect(orientedContainer.querySelector('[data-flip-marker="7"]')).toBeNull()
    expect(misorientedContainer.querySelector('[data-flip-marker="7"]')).not.toBeNull()

    // Overall markup for UF edge is different
    expect(orientedUF.parentElement?.innerHTML).not.toEqual(misorientedUF.parentElement?.innerHTML)
  })

  it('renders a real EO case across four AUFs', () => {
    expect(SAMPLE_EO_CASE).toBeDefined()
    const markup = SAMPLE_EO_CASE!.facelets.map(
      (f) => render(<EoDiagram facelets={f} />).container.innerHTML,
    )
    expect(markup).toHaveLength(4)
  })

  describe('malformed input', () => {
    it.each([
      ['too short', '0'.repeat(21)],
      ['too long', '0'.repeat(29)],
      ['unknown letter', 'Z' + ALL_ORIENTED.slice(1)],
      ['empty', ''],
    ])('throws in development on a %s string', (_why, facelets) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      expect(() => render(<EoDiagram facelets={facelets} />)).toThrow(/malformed facelet string/)
    })
  })
})
