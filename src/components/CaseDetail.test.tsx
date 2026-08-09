import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CaseDetail } from './CaseDetail'
import { CASES } from '@/data'
import type { ProgressRecord } from '@/storage/db'

// Setup mocks for storage/db
const mockSetCustomAlg = vi.fn()
const mockSetPrimaryAlgIndex = vi.fn()
const mockToggleLearned = vi.fn()

vi.mock('@/storage/db', () => {
  return {
    setCustomAlg: (...args: any[]) => mockSetCustomAlg(...args),
    setPrimaryAlgIndex: (...args: any[]) => mockSetPrimaryAlgIndex(...args),
    toggleLearned: (...args: any[]) => mockToggleLearned(...args),
    chosenAlg: (algs: any[], progress: any) => {
      if (progress?.customAlg) return progress.customAlg
      return algs[progress?.primaryAlgIndex ?? 0] ?? algs[0]
    },
  }
})

describe('CaseDetail', () => {
  const testCase = CASES[0]
  const mockOnProgressChange = vi.fn()
  const mockOnBack = vi.fn()

  const defaultProgress: ProgressRecord = {
    caseId: testCase.id,
    learned: false,
    primaryAlgIndex: 0,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the case details correctly', () => {
    render(
      <CaseDetail
        c={testCase}
        progress={defaultProgress}
        onProgressChange={mockOnProgressChange}
        onBack={mockOnBack}
      />
    )

    // Check header details are rendered
    expect(screen.getByText(`Set ${testCase.set} • ${testCase.group}`)).toBeInTheDocument()
    expect(screen.getByText(testCase.displayName)).toBeInTheDocument()

    // Check active algorithm is displayed
    const algElements = screen.getAllByText(testCase.algs[0].alg)
    expect(algElements.length).toBeGreaterThan(0)
    expect(algElements[0]).toBeInTheDocument()
  })

  it('accepts and persists a valid custom algorithm', async () => {
    // For testCase, the sheet's own first algorithm is always a valid algorithm
    const validAlgStr = testCase.algs[0].alg
    const expectedProgress: ProgressRecord = {
      ...defaultProgress,
      customAlg: { alg: validAlgStr, aufOffset: 0 },
    }

    mockSetCustomAlg.mockResolvedValue(expectedProgress)

    render(
      <CaseDetail
        c={testCase}
        progress={defaultProgress}
        onProgressChange={mockOnProgressChange}
        onBack={mockOnBack}
      />
    )

    const input = screen.getByLabelText('Custom algorithm input')
    fireEvent.change(input, { target: { value: validAlgStr } })

    const applyBtn = screen.getByRole('button', { name: 'Apply' })
    fireEvent.click(applyBtn)

    // Should call setCustomAlg with the case id and the parsed CaseAlg object
    await waitFor(() => {
      expect(mockSetCustomAlg).toHaveBeenCalledWith(testCase.id, {
        alg: validAlgStr,
        aufOffset: expect.any(Number),
      })
      expect(mockOnProgressChange).toHaveBeenCalledWith(expectedProgress)
    })

    // Error message should not be visible
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows an error and does NOT persist an invalid custom algorithm', async () => {
    render(
      <CaseDetail
        c={testCase}
        progress={defaultProgress}
        onProgressChange={mockOnProgressChange}
        onBack={mockOnBack}
      />
    )

    const input = screen.getByLabelText('Custom algorithm input')
    // "nonsense" is invalid and cannot be parsed or applied
    fireEvent.change(input, { target: { value: 'nonsense' } })

    const applyBtn = screen.getByRole('button', { name: 'Apply' })
    fireEvent.click(applyBtn)

    // Should show error reason to the user
    await waitFor(() => {
      const errorText = screen.getByRole('alert')
      expect(errorText).toBeInTheDocument()
      expect(errorText.textContent).toContain('Could not read "nonsense"')
    })

    // setCustomAlg should not be called
    expect(mockSetCustomAlg).not.toHaveBeenCalled()
    expect(mockOnProgressChange).not.toHaveBeenCalled()
  })

  it('shows an error when a valid move sequence is entered but does not solve the case', async () => {
    render(
      <CaseDetail
        c={testCase}
        progress={defaultProgress}
        onProgressChange={mockOnProgressChange}
        onBack={mockOnBack}
      />
    )

    const input = screen.getByLabelText('Custom algorithm input')
    // "U" is a valid algorithm token, but does not solve the testCase
    fireEvent.change(input, { target: { value: 'U' } })

    const applyBtn = screen.getByRole('button', { name: 'Apply' })
    fireEvent.click(applyBtn)

    await waitFor(() => {
      const errorText = screen.getByRole('alert')
      expect(errorText).toBeInTheDocument()
      expect(errorText.textContent).toContain('does not solve this case')
    })

    // setCustomAlg should not be called
    expect(mockSetCustomAlg).not.toHaveBeenCalled()
    expect(mockOnProgressChange).not.toHaveBeenCalled()
  })

  it('tapping an alternative changes the chosen algorithm', async () => {
    // If the case only has one alternative, we can still tap it. Let's make sure it works.
    const indexToTap = 0
    const expectedProgressAfterPrimary: ProgressRecord = {
      ...defaultProgress,
      primaryAlgIndex: indexToTap,
    }
    const expectedProgressFinal: ProgressRecord = {
      ...expectedProgressAfterPrimary,
      customAlg: undefined,
    }

    mockSetPrimaryAlgIndex.mockResolvedValue(expectedProgressAfterPrimary)
    mockSetCustomAlg.mockResolvedValue(expectedProgressFinal)

    render(
      <CaseDetail
        c={testCase}
        progress={defaultProgress}
        onProgressChange={mockOnProgressChange}
        onBack={mockOnBack}
      />
    )

    // Find the alternative button
    const altBtn = screen.getByRole('button', { name: new RegExp(`Select alternative ${indexToTap + 1}`, 'i') })
    fireEvent.click(altBtn)

    await waitFor(() => {
      expect(mockSetPrimaryAlgIndex).toHaveBeenCalledWith(testCase.id, indexToTap)
      expect(mockSetCustomAlg).toHaveBeenCalledWith(testCase.id, undefined)
      expect(mockOnProgressChange).toHaveBeenCalledWith(expectedProgressFinal)
    })
  })
})
