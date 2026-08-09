import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { SettingsView } from './SettingsView'
import { clearAll, putAll } from '@/storage/db'

vi.mock('@/storage/db', () => {
  return {
    allProgress: vi.fn(async () => new Map()),
    allAttempts: vi.fn(async () => []),
    clearAll: vi.fn(async () => {}),
    putAll: vi.fn(async () => {}),
  }
})

vi.mock('@/storage/backup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/storage/backup')>()
  return {
    ...actual,
    parseBackup: vi.fn((text) => actual.parseBackup(text)),
  }
})

describe('SettingsView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('shows error reason and does NOT clear existing data when importing a malformed file', async () => {
    render(<SettingsView />)

    // Select a malformed file (invalid format)
    const file = new File(['{"format": "invalid-format"}'], 'backup.json', { type: 'application/json' })
    const input = screen.getByTestId('import-file-input')
    
    fireEvent.change(input, { target: { files: [file] } })

    // Wait for the parsing and rejection message to show up
    await waitFor(() => {
      expect(screen.getByTestId('import-error')).toBeInTheDocument()
    })

    expect(screen.getByText('That file is not a Lock In backup.')).toBeInTheDocument()

    // Assert that clearAll was NOT called
    expect(clearAll).not.toHaveBeenCalled()
    expect(putAll).not.toHaveBeenCalled()
  })

  it('shows confirmation modal and clears/updates data when confirming a valid import', async () => {
    // Construct a valid backup JSON structure
    const validBackup = {
      format: 'lock-in-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      progress: [
        { caseId: 'T1', learned: true, primaryAlgIndex: 0 }
      ],
      attempts: [
        { caseId: 'T1', ms: 2500, at: Date.now(), auf: 1 }
      ]
    }

    render(<SettingsView />)

    const file = new File([JSON.stringify(validBackup)], 'backup.json', { type: 'application/json' })
    const input = screen.getByTestId('import-file-input')
    
    fireEvent.change(input, { target: { files: [file] } })

    // Verify confirmation modal is shown
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
    })

    // clearAll should NOT be called yet before confirmation
    expect(clearAll).not.toHaveBeenCalled()

    // Click confirm button
    const confirmBtn = screen.getByTestId('confirm-import-button')
    fireEvent.click(confirmBtn)

    // Wait for import to complete
    await waitFor(() => {
      expect(screen.getByTestId('import-success')).toBeInTheDocument()
    })

    // Assert database was cleared and populated with valid data
    expect(clearAll).toHaveBeenCalledTimes(1)
    expect(putAll).toHaveBeenCalledWith(
      validBackup.progress,
      expect.any(Array) // Incoming ids are stripped/ignored
    )
  })
})
