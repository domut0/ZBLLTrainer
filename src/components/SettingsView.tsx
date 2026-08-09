import { useState, useEffect } from 'react'
import { allProgress, allAttempts, clearAll, putAll } from '@/storage/db'
import { buildBackup, parseBackup, backupFilename } from '@/storage/backup'

export function SettingsView() {
  const [lastExport, setLastExport] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importSuccess, setImportSuccess] = useState<boolean>(false)
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false)
  const [pendingBackupData, setPendingBackupData] = useState<any>(null)

  useEffect(() => {
    const stored = localStorage.getItem('lock-in-last-export')
    setLastExport(stored)
  }, [])

  const handleExport = async () => {
    try {
      const progressMap = await allProgress()
      const attemptsList = await allAttempts()
      const backup = buildBackup(Array.from(progressMap.values()), attemptsList)
      
      const json = JSON.stringify(backup, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      
      const a = document.createElement('a')
      a.href = url
      a.download = backupFilename()
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const nowStr = new Date().toISOString()
      localStorage.setItem('lock-in-last-export', nowStr)
      setLastExport(nowStr)
      setImportError(null)
      setImportSuccess(false)
    } catch (err) {
      console.error('Export failed:', err)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportError(null)
    setImportSuccess(false)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      const text = evt.target?.result as string
      const parsed = parseBackup(text)
      if (!parsed.ok) {
        setImportError(parsed.reason)
        return
      }

      setPendingBackupData(parsed.data)
      setShowConfirmModal(true)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const confirmImport = async () => {
    if (!pendingBackupData) return
    try {
      await clearAll()
      await putAll(pendingBackupData.progress, pendingBackupData.attempts)
      setImportSuccess(true)
      setPendingBackupData(null)
      setShowConfirmModal(false)
    } catch (err) {
      console.error('Import failed:', err)
      setImportError('Failed to write database records.')
      setPendingBackupData(null)
      setShowConfirmModal(false)
    }
  }

  const daysSinceExport = (() => {
    if (!lastExport) return null
    const ms = Date.now() - new Date(lastExport).getTime()
    return Math.floor(ms / (1000 * 60 * 60 * 24))
  })()

  const showNag = lastExport === null || (daysSinceExport !== null && daysSinceExport >= 30)

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-50 select-none">
      <header className="flex-none h-14 border-b border-zinc-900 flex items-center justify-between px-4 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
          Settings
        </h1>
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/50 px-2.5 py-1 rounded-lg border border-zinc-800/40">
          Data
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 animate-in fade-in duration-200">
        {/* Nag Banner */}
        {showNag && (
          <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-amber-200 flex flex-col gap-2" data-testid="export-nag">
            <div className="flex items-center gap-2 font-bold text-sm">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Unbacked Progress
            </div>
            <p className="text-xs leading-relaxed text-amber-300/90">
              {lastExport === null
                ? "You have never backed up your progress. Browser storage can be cleared at any time. Export your data now to keep it safe."
                : `Your last backup was ${daysSinceExport} days ago. Back up regularly to protect against data loss.`}
            </p>
          </div>
        )}

        {/* Backup Card */}
        <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/80 p-5 flex flex-col gap-5">
          <div>
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider mb-1">
              Backup & Restore
            </h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Export your learned cases and timed attempts to a file. Import it back to restore on another device.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleExport}
              className="h-12 w-full rounded-xl bg-zinc-100 text-zinc-950 text-sm font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2 focus:outline-none"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Data
            </button>

            <label className="h-12 w-full rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 text-sm font-semibold active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Data
              <input
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
                data-testid="import-file-input"
              />
            </label>
          </div>

          {lastExport && (
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-center mt-1">
              Last backup: {new Date(lastExport).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Feedback / Alerts */}
        {importError && (
          <div className="p-4 rounded-xl bg-red-950/20 border border-red-500/30 text-red-200 text-xs leading-relaxed" data-testid="import-error">
            <span className="font-bold text-red-400 block mb-1">Import Rejected</span>
            {importError}
          </div>
        )}

        {importSuccess && (
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-200 text-xs leading-relaxed" data-testid="import-success">
            <span className="font-bold text-emerald-400 block mb-1">Success</span>
            Your progress and attempts have been restored successfully.
          </div>
        )}
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6" data-testid="confirm-modal">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 p-5 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div>
              <h3 className="text-base font-bold text-zinc-100 mb-2">Replace current data?</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This will overwrite all your current progress and timed attempts. This action cannot be undone.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowConfirmModal(false)
                  setPendingBackupData(null)
                }}
                className="flex-1 h-11 rounded-xl bg-zinc-950 border border-zinc-800 text-sm font-semibold text-zinc-300 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmImport}
                data-testid="confirm-import-button"
                className="flex-1 h-11 rounded-xl bg-red-600 text-white text-sm font-semibold active:scale-[0.98] transition-all hover:bg-red-500 focus:outline-none"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SettingsView
