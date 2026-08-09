import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { StatsView } from './StatsView'
import { CASES } from '@/data'
import type { AttemptRecord } from '@/storage/db'

let mockAttempts: AttemptRecord[] = []

vi.mock('@/storage/db', () => {
  return {
    allAttempts: vi.fn(async () => [...mockAttempts]),
  }
})

describe('StatsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAttempts = []
  })

  it('renders a dash, not 0.00, for a case with no attempts', async () => {
    mockAttempts = [
      { id: 1, caseId: CASES[1].id, ms: 3000, at: Date.now(), auf: 0 },
    ]

    render(<StatsView algSet="ZBLL" />)

    await waitFor(() => {
      expect(screen.getByText(CASES[0].displayName)).toBeInTheDocument()
    })

    const rows = screen.getAllByTestId('stats-row')
    
    const row0 = rows.find((r) => r.querySelector('[data-testid="stats-case-name"]')?.textContent === CASES[0].displayName)
    const row1 = rows.find((r) => r.querySelector('[data-testid="stats-case-name"]')?.textContent === CASES[1].displayName)

    expect(row0).toBeDefined()
    expect(row1).toBeDefined()

    const median0 = row0?.querySelector('[data-testid="stats-median"]')?.textContent
    const attempts0 = row0?.querySelector('[data-testid="stats-attempts"]')?.textContent

    const median1 = row1?.querySelector('[data-testid="stats-median"]')?.textContent
    const attempts1 = row1?.querySelector('[data-testid="stats-attempts"]')?.textContent

    expect(attempts0).toBe('0')
    expect(median0).toBe('-')
    expect(median0).not.toBe('0.00')

    expect(attempts1).toBe('1')
    expect(median1).toBe('3.00')
  })

  it('sorting by median reorders the rows', async () => {
    // Set up:
    // Case 0: 2.00s median (fastest)
    // Case 1: 5.00s median (slowest)
    // Case 2: no attempts (dash)
    mockAttempts = [
      { id: 1, caseId: CASES[0].id, ms: 2000, at: Date.now(), auf: 0 },
      { id: 2, caseId: CASES[1].id, ms: 5000, at: Date.now(), auf: 0 },
    ]

    render(<StatsView algSet="ZBLL" />)

    await waitFor(() => {
      expect(screen.getByText(CASES[0].displayName)).toBeInTheDocument()
    })

    // Initially, it should be sorted by median desc by default
    {
      const rows = screen.getAllByTestId('stats-row')
      const names = rows.slice(0, 3).map((r) => r.querySelector('[data-testid="stats-case-name"]')?.textContent)
      
      expect(names[0]).toBe(CASES[1].displayName)
      expect(names[1]).toBe(CASES[0].displayName)
    }

    // Click the median sort button. This will toggle it to 'asc' (fastest first).
    const sortMedianBtn = screen.getByTestId('sort-median-button')
    fireEvent.click(sortMedianBtn)

    // Wait for sorting to apply
    await waitFor(() => {
      const rows = screen.getAllByTestId('stats-row')
      const names = rows.slice(0, 3).map((r) => r.querySelector('[data-testid="stats-case-name"]')?.textContent)
      
      expect(names[0]).toBe(CASES[0].displayName)
      expect(names[1]).toBe(CASES[1].displayName)
    })

    // Click again to toggle it back to 'desc' (slowest first)
    fireEvent.click(sortMedianBtn)

    await waitFor(() => {
      const rows = screen.getAllByTestId('stats-row')
      const names = rows.slice(0, 3).map((r) => r.querySelector('[data-testid="stats-case-name"]')?.textContent)

      expect(names[0]).toBe(CASES[1].displayName)
      expect(names[1]).toBe(CASES[0].displayName)
    })
  })
})
