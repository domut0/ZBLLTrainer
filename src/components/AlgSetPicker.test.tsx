import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { AlgSetPicker } from './AlgSetPicker'
import { ALG_SETS } from '@/data'
import type { AlgSetDef } from '@/data'

describe('AlgSetPicker', () => {
  it('renders a tab for every registered set, and only those', () => {
    render(<AlgSetPicker sets={ALG_SETS} value="ZBLL" onChange={() => {}} />)
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(ALG_SETS.map((s) => s.label))
    expect(screen.getByTestId('alg-set-ZBLL')).toHaveAttribute('aria-selected', 'true')
  })

  // With one set registered the picker still has to be on screen — it is how
  // the user learns the app is scoped to a set at all.
  it('shows even when there is only one set', () => {
    expect(ALG_SETS.length).toBe(1)
    render(<AlgSetPicker sets={ALG_SETS} value="ZBLL" onChange={() => {}} />)
    expect(screen.getByTestId('alg-set-picker')).toBeInTheDocument()
  })

  it('reports the set that was clicked', () => {
    const onChange = vi.fn()
    // Two synthetic sets, so the click has somewhere to go before COLL exists.
    const sets: AlgSetDef[] = [
      { id: 'ZBLL', label: 'ZBLL', blurb: 'a', subsets: [], diagram: 'last-layer' },
      { id: 'COLL', label: 'COLL', blurb: 'b', subsets: [], diagram: 'last-layer' },
    ]
    render(<AlgSetPicker sets={sets} value="ZBLL" onChange={onChange} />)

    fireEvent.click(screen.getByTestId('alg-set-COLL'))
    expect(onChange).toHaveBeenCalledWith('COLL')
  })
})
