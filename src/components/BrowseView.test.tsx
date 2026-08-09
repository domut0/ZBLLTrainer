import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { BrowseView } from './BrowseView'

// Local mock progress map for testing
let mockProgressMap = new Map<string, any>()

// Mock the storage/db module
vi.mock('@/storage/db', () => {
  return {
    allProgress: vi.fn(async () => new Map(mockProgressMap)),
    toggleLearned: vi.fn(async (caseId: string) => {
      const existing = mockProgressMap.get(caseId) || { caseId, learned: false, primaryAlgIndex: 0 }
      const next = { ...existing, learned: !existing.learned }
      mockProgressMap.set(caseId, next)
      return next
    }),
    DEFAULT_PROGRESS: (caseId: string) => ({
      caseId,
      learned: false,
      primaryAlgIndex: 0,
    }),
  }
})

describe('BrowseView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockProgressMap = new Map()
  })

  it('renders the sets list initially', async () => {
    render(<BrowseView />)

    // Wait for the data to load and render header
    await waitFor(() => {
      expect(screen.getByText('Lock In ZBLL')).toBeInTheDocument()
    })

    // Check that we see standard sets (T, U, L, H, Pi, S, AS)
    expect(screen.getByText('T')).toBeInTheDocument()
    expect(screen.getByText('U')).toBeInTheDocument()
    expect(screen.getByText('AS')).toBeInTheDocument()
  })

  it('updates the ticked count when a case is toggled', async () => {
    render(<BrowseView />)

    // Wait for load
    await screen.findByText('Lock In ZBLL')

    // Find the Set T button
    const setTBtn = screen.getByRole('button', { name: /Set T/i })
    expect(setTBtn).toBeInTheDocument()

    // Every set except H holds 72 cases.
    const totalSetT = 72

    // Click Set T to go to groups
    fireEvent.click(setTBtn)

    // Expect group screen with "Set T" header
    expect(await screen.findByText('Set T')).toBeInTheDocument()

    // Find first group button
    const groupButtons = screen.getAllByLabelText(/Group .*, \d+ of \d+ cases learned/i)
    expect(groupButtons.length).toBeGreaterThan(0)
    const firstGroupBtn = groupButtons[0]

    // Parse total cases in this group
    const groupLabel = firstGroupBtn.getAttribute('aria-label') || ''
    const groupMatch = groupLabel.match(/Group (.*), \d+ of (\d+) cases learned/i)
    expect(groupMatch).not.toBeNull()
    const groupName = groupMatch![1]
    const totalGroupCases = parseInt(groupMatch![2], 10)

    // Click group to go to case grid
    fireEvent.click(firstGroupBtn)

    // Expect case grid view with group header name
    expect(await screen.findByText(groupName)).toBeInTheDocument()

    // Find the Case 1 button
    const case1Btn = screen.getByLabelText('Case 1, not learned')
    expect(case1Btn).toBeInTheDocument()

    // Tap Case 1 to toggle learned
    fireEvent.click(case1Btn)

    // The case should now be learned
    await waitFor(() => {
      expect(screen.getByLabelText('Case 1, learned')).toBeInTheDocument()
    })

    // Go back to Groups and check ticked count
    const backToGroupsBtn = screen.getByRole('button', { name: /Back to Groups/i })
    fireEvent.click(backToGroupsBtn)

    // Wait for groups list to render
    expect(await screen.findByText('Set T')).toBeInTheDocument()

    // The group count should now show "1 of <total>"
    const updatedGroupBtn = screen.getAllByLabelText(new RegExp(`Group ${groupName}, 1 of ${totalGroupCases} cases learned`, 'i'))[0]
    expect(updatedGroupBtn).toBeInTheDocument()

    // Go back to Sets and check ticked count
    const backToSetsBtn = screen.getByRole('button', { name: /Back to Sets/i })
    fireEvent.click(backToSetsBtn)

    // Wait for sets list
    expect(await screen.findByText('Lock In ZBLL')).toBeInTheDocument()

    // The set count should now show "1 of <total>"
    const updatedSetBtn = screen.getByRole('button', { name: new RegExp(`Set T, 1 of ${totalSetT} cases learned`, 'i') })
    expect(updatedSetBtn).toBeInTheDocument()
  })

  it('filters the visible set of cases when selecting different filter modes', async () => {
    render(<BrowseView />)

    // Wait for load
    await screen.findByText('Lock In ZBLL')

    // Click Set T -> First Group
    fireEvent.click(screen.getByRole('button', { name: /Set T/i }))
    const groupButtons = await screen.findAllByLabelText(/Group .*, \d+ of \d+ cases learned/i)
    const firstGroupBtn = groupButtons[0]
    
    const groupLabel = firstGroupBtn.getAttribute('aria-label') || ''
    const groupMatch = groupLabel.match(/Group (.*), \d+ of (\d+) cases learned/i)
    const totalGroupCases = parseInt(groupMatch![2], 10)

    fireEvent.click(firstGroupBtn)

    // Wait for Case 1 button to show up in grid
    const case1 = await screen.findByLabelText('Case 1, not learned')
    expect(case1).toBeInTheDocument()

    // Helper to get currently visible cases
    const getVisibleCases = () => screen.queryAllByLabelText(/Case \d+/i)
    expect(getVisibleCases().length).toBe(totalGroupCases)

    // Toggle Case 1 to learned
    fireEvent.click(case1)
    await waitFor(() => {
      expect(screen.getByLabelText('Case 1, learned')).toBeInTheDocument()
    })

    // Under "all" filter, we still see all cases
    expect(getVisibleCases().length).toBe(totalGroupCases)

    // Switch filter to "ticked"
    fireEvent.click(screen.getByRole('button', { name: 'ticked' }))

    // We should now only see exactly 1 case (Case 1)
    await waitFor(() => {
      const tickedCases = getVisibleCases()
      expect(tickedCases.length).toBe(1)
      expect(tickedCases[0]).toHaveAttribute('aria-label', 'Case 1, learned')
    })

    // Switch filter to "unticked"
    fireEvent.click(screen.getByRole('button', { name: 'unticked' }))

    // We should see (total - 1) cases, and Case 1 should not be among them
    await waitFor(() => {
      const untickedCases = getVisibleCases()
      expect(untickedCases.length).toBe(totalGroupCases - 1)
      const foundCase1 = untickedCases.find((c) => c.getAttribute('aria-label') === 'Case 1, learned')
      expect(foundCase1).toBeUndefined()
    })
  })
})
