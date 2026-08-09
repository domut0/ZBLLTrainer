import { useState } from 'react'
import type { TrainerCase } from '@/data/types'
import { LLDiagram } from '@/components/LLDiagram'
import {
  setCustomAlg,
  setPrimaryAlgIndex,
  toggleLearned,
  chosenAlg,
  type ProgressRecord,
} from '@/storage/db'
import { validateAlgForCase } from '@/cube/apply'

interface CaseDetailProps {
  c: TrainerCase
  progress: ProgressRecord
  onProgressChange: (next: ProgressRecord) => void
  onBack: () => void
}

export function CaseDetail({ c, progress, onProgressChange, onBack }: CaseDetailProps) {
  const [customText, setCustomText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const activeAlg = chosenAlg(c.algs, progress)
  const isCustom = !!progress.customAlg
  const primaryAlgIndex = progress.primaryAlgIndex ?? 0
  const isTicked = progress.learned

  const handleToggleLearned = async () => {
    try {
      const next = await toggleLearned(c.id)
      onProgressChange(next)
    } catch (err) {
      console.error('Failed to toggle learned state:', err)
    }
  }

  const handleSelectAlternative = async (index: number) => {
    try {
      // First update the primary index in DB
      await setPrimaryAlgIndex(c.id, index)
      // Then clear the custom algorithm in DB so the primary index takes effect
      const next = await setCustomAlg(c.id, undefined)
      onProgressChange(next)
      setError(null)
    } catch (err) {
      console.error('Failed to select alternative algorithm:', err)
    }
  }

  const handleSubmitCustom = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const trimmed = customText.trim()
    if (!trimmed) {
      setError('Enter an algorithm.')
      return
    }

    const validation = validateAlgForCase(trimmed, c.state)
    if (validation.ok) {
      try {
        const next = await setCustomAlg(c.id, {
          alg: validation.alg,
          aufOffset: validation.aufOffset,
        })
        onProgressChange(next)
        setCustomText('')
      } catch (err) {
        console.error('Failed to save custom algorithm:', err)
        setError('Failed to save algorithm to database.')
      }
    } else {
      setError(validation.reason)
    }
  }

  const handleRevert = async () => {
    try {
      const next = await setCustomAlg(c.id, undefined)
      onProgressChange(next)
      setError(null)
    } catch (err) {
      console.error('Failed to revert to default algorithm:', err)
    }
  }

  return (
    <div className="flex flex-col gap-6 select-none max-w-md mx-auto">
      {/* Header Info */}
      <div className="text-center mt-2">
        <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
          {c.subset ? `${c.subset} • ` : ''}{c.group}
        </span>
        <h2 className="text-3xl font-extrabold text-zinc-100 tracking-tight mt-1">
          {c.displayName}
        </h2>
      </div>

      {/* Large Diagram */}
      <div className="flex justify-center my-2">
        <div className="w-52 h-52 p-4 bg-zinc-900/20 border border-zinc-800/60 rounded-3xl flex items-center justify-center shadow-inner">
          <LLDiagram facelets={c.facelets[0]} className="w-44 h-44" label={`Diagram for ${c.displayName}`} />
        </div>
      </div>

      {/* Tick Control / Learned Toggle */}
      <button
        onClick={handleToggleLearned}
        className={`w-full h-12 flex items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-all active:scale-[0.98] ${
          isTicked
            ? 'bg-emerald-950/30 border-emerald-500/60 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-300'
        }`}
        aria-label={`Mark ${c.displayName} as ${isTicked ? 'not learned' : 'learned'}`}
      >
        <svg
          className={`w-5 h-5 stroke-[2.5] ${isTicked ? 'text-emerald-400' : 'text-zinc-500'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        {isTicked ? 'Learned' : 'Mark as Learned'}
      </button>

      {/* Prominent Active Algorithm display */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Active Algorithm
        </span>
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="font-mono text-lg font-bold text-zinc-100 break-words text-center py-2 select-text">
            {activeAlg.alg}
          </div>
          <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider border-t border-zinc-800/40 pt-2.5 mt-1">
            <span>
              Source: <span className={isCustom ? 'text-amber-400' : 'text-zinc-400'}>{isCustom ? 'Custom' : `Sheet Alt ${primaryAlgIndex + 1}`}</span>
            </span>
            <span>AUF Offset: {activeAlg.aufOffset}</span>
          </div>
        </div>
      </div>

      {/* Alternatives list */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Sheet Alternatives
        </span>
        <div className="flex flex-col gap-2">
          {c.algs.map((algObj, index) => {
            const isSelected = !isCustom && primaryAlgIndex === index
            return (
              <button
                key={index}
                onClick={() => handleSelectAlternative(index)}
                className={`flex flex-col p-3 rounded-xl border text-left transition-all active:scale-[0.99] min-h-[56px] ${
                  isSelected
                    ? 'border-purple-500/60 bg-purple-950/10 text-purple-200'
                    : 'border-zinc-800/80 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700/60 hover:text-zinc-300'
                }`}
                aria-label={`Select alternative ${index + 1}: ${algObj.alg}`}
              >
                <div className="flex justify-between items-center w-full mb-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Alternative {index + 1}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/50">
                      Active
                    </span>
                  )}
                </div>
                <div className="font-mono text-sm font-semibold break-all text-zinc-200">
                  {algObj.alg}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Custom algorithm input */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Use Custom Algorithm
        </span>
        <form onSubmit={handleSubmitCustom} className="flex gap-2">
          <input
            type="text"
            placeholder="Paste algorithm (e.g. R U R' U'...)"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            className="h-12 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 flex-1 min-w-0"
            aria-label="Custom algorithm input"
          />
          <button
            type="submit"
            className="h-12 px-5 font-semibold text-sm rounded-xl bg-zinc-100 text-zinc-950 hover:bg-zinc-200 active:scale-[0.98] transition-all shrink-0"
          >
            Apply
          </button>
        </form>
        {error && (
          <p className="text-red-400 text-xs mt-1" role="alert">
            {error}
          </p>
        )}

        {isCustom && (
          <button
            type="button"
            onClick={handleRevert}
            className="h-12 w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-semibold text-zinc-400 hover:text-zinc-300 active:scale-[0.98] transition-all mt-1"
          >
            Revert to Sheet Default
          </button>
        )}
      </div>

      {/* Simple navigation utility button */}
      <button
        onClick={onBack}
        className="h-12 w-full flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-semibold text-zinc-200 active:scale-[0.98] transition-all mt-4 mb-8 md:hidden"
      >
        <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        Back to Grid
      </button>
    </div>
  )
}
