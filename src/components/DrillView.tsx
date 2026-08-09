import { useCallback, useEffect, useRef, useState } from 'react'
import { CASES, CASES_BY_ID, SCRAMBLES } from '@/data'
import type { Scramble, ZbllCase } from '@/data/types'
import { LLDiagram } from '@/components/LLDiagram'
import { revealAlgorithm } from '@/drill/reveal'
import {
  addAttempt,
  allProgress,
  chosenAlg,
  discardLastAttempt,
  type ProgressRecord,
} from '@/storage/db'

/*
 * The drill loop (Issue 07). A scramble appears, you apply it, hold to ready,
 * release to start, execute, tap to stop, and the case is revealed.
 *
 * The whole feature turns on one thing: the case is served at a RANDOM AUF, so
 * neither the algorithm nor the diagram may be shown as stored.
 *
 *   - the algorithm goes through `revealAlgorithm(chosenAlg(...), servedAuf)`.
 *     Printing `alg.alg` shows a sequence that does not solve the cube in the
 *     user's hands. See the header of src/drill/reveal.ts.
 *   - the diagram is `c.facelets[servedAuf]`, never `c.facelets[0]`, which
 *     would draw a different orientation to the one on the table.
 *
 * The served AUF is not generated here: every scramble in scrambles.json
 * carries the AUF it presents the case at, and that entry's `auf` IS the
 * served AUF.
 */

/** Conventional short hold before the timer arms. */
const HOLD_MS = 300

type Phase =
  | { kind: 'idle' }
  | { kind: 'holding' }
  | { kind: 'ready' }
  | { kind: 'running'; startedAt: number }
  | { kind: 'stopped'; ms: number }

interface Served {
  c: ZbllCase
  scramble: Scramble
}

/** Uniform choice. `Math.random()` is < 1, but clamp anyway so a stubbed one is safe. */
function pick<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.min(items.length - 1, Math.floor(Math.random() * items.length))]
}

/** The active pool: ticked cases that actually have scrambles to serve. */
function drillPool(progress: Map<string, ProgressRecord>): ZbllCase[] {
  return CASES.filter(
    (c) => progress.get(c.id)?.learned === true && (SCRAMBLES[c.id]?.length ?? 0) > 0,
  )
}

function serveFrom(pool: readonly ZbllCase[]): Served | null {
  const c = pick(pool)
  if (!c) return null
  const scramble = pick(SCRAMBLES[c.id] ?? [])
  if (!scramble) return null
  return { c, scramble }
}

function formatMs(ms: number): string {
  const totalSeconds = ms / 1000
  if (totalSeconds < 60) return totalSeconds.toFixed(2)
  const minutes = Math.floor(totalSeconds / 60)
  return `${minutes}:${(totalSeconds - minutes * 60).toFixed(2).padStart(5, '0')}`
}

/** The same, with a unit, for prose rather than the clock. */
const spokenMs = (ms: number): string => (ms < 60_000 ? `${formatMs(ms)}s` : formatMs(ms))

export interface DrillViewProps {
  /** Send the user to browse, so an empty pool has somewhere to go. */
  onGoToBrowse?: () => void
}

export function DrillView({ onGoToBrowse }: DrillViewProps) {
  const [progress, setProgress] = useState<Map<string, ProgressRecord>>(new Map())
  const [pool, setPool] = useState<ZbllCase[] | null>(null)
  const [served, setServed] = useState<Served | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState<string | null>(null)

  const holdTimer = useRef<number | null>(null)

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  // Load progress once, build the pool, serve the first scramble.
  useEffect(() => {
    let cancelled = false
    allProgress()
      .then((p) => {
        if (cancelled) return
        setProgress(p)
        const next = drillPool(p)
        setPool(next)
        setServed(serveFrom(next))
      })
      .catch((err: unknown) => {
        console.error('Failed to load progress for the drill pool:', err)
        if (!cancelled) setPool([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => clearHold, [clearHold])

  // The running clock. `phase` is replaced only when the phase itself changes,
  // so re-renders from setElapsed do not restart the interval.
  useEffect(() => {
    if (phase.kind !== 'running') return
    const started = phase.startedAt
    const id = window.setInterval(() => setElapsed(Date.now() - started), 30)
    return () => window.clearInterval(id)
  }, [phase])

  const stop = useCallback(() => {
    if (phase.kind !== 'running' || !served) return
    const at = Date.now()
    const ms = at - phase.startedAt
    setElapsed(ms)
    setPhase({ kind: 'stopped', ms })
    addAttempt({ caseId: served.c.id, ms, at, auf: served.scramble.auf }).catch(
      (err: unknown) => {
        console.error('Failed to record attempt:', err)
        setNote('Could not save that attempt.')
      },
    )
  }, [phase, served])

  const nextScramble = useCallback(() => {
    clearHold()
    setNote(null)
    setElapsed(0)
    setPhase({ kind: 'idle' })
    setServed(serveFrom(pool ?? []))
  }, [clearHold, pool])

  const handleDiscard = useCallback(async () => {
    try {
      const removed = await discardLastAttempt()
      if (!removed) {
        setNote('Nothing to discard.')
        return
      }
      const name = CASES_BY_ID.get(removed.caseId)?.displayName ?? removed.caseId
      setNote(`Discarded ${spokenMs(removed.ms)} on ${name}.`)
    } catch (err: unknown) {
      console.error('Failed to discard the last attempt:', err)
      setNote('Could not discard that attempt.')
    }
  }, [])

  const press = useCallback(() => {
    if (phase.kind === 'running') {
      stop()
      return
    }
    if (phase.kind !== 'idle') return
    clearHold()
    setPhase({ kind: 'holding' })
    holdTimer.current = window.setTimeout(() => {
      holdTimer.current = null
      setPhase({ kind: 'ready' })
    }, HOLD_MS)
  }, [clearHold, phase, stop])

  const release = useCallback(() => {
    if (phase.kind === 'ready') {
      setElapsed(0)
      setPhase({ kind: 'running', startedAt: Date.now() })
      return
    }
    if (phase.kind === 'holding') {
      // Released before the hold completed: never armed, so nothing starts.
      clearHold()
      setPhase({ kind: 'idle' })
    }
  }, [clearHold, phase])

  const cancel = useCallback(() => {
    if (phase.kind === 'holding' || phase.kind === 'ready') {
      clearHold()
      setPhase({ kind: 'idle' })
    }
  }, [clearHold, phase])

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Keeps the touch from scrolling the page or starting a selection.
      e.preventDefault()
      press()
    },
    [press],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      release()
    },
    [release],
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      if (e.repeat) return
      press()
    },
    [press],
  )

  const onKeyUp = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key !== ' ' && e.key !== 'Enter') return
      e.preventDefault()
      release()
    },
    [release],
  )

  if (pool === null) {
    return (
      <Shell>
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
          Loading your pool…
        </div>
      </Shell>
    )
  }

  if (pool.length === 0 || !served) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-zinc-100">Nothing to drill yet</h2>
          <p className="text-sm text-zinc-400 max-w-[16rem]">
            The drill pool is every case you have ticked as learned. Go to Browse and tick a
            case to start drilling it.
          </p>
          {onGoToBrowse && (
            <button
              onClick={onGoToBrowse}
              className="mt-2 h-12 px-6 rounded-xl bg-zinc-100 text-zinc-950 text-sm font-semibold active:scale-[0.98] transition-all"
            >
              Go to Browse
            </button>
          )}
        </div>
      </Shell>
    )
  }

  const { c, scramble } = served
  const servedAuf = scramble.auf
  const alg = chosenAlg(c.algs, progress.get(c.id))
  const revealed = revealAlgorithm(alg, servedAuf)
  const stopped = phase.kind === 'stopped'
  const running = phase.kind === 'running'

  const timerColour =
    phase.kind === 'ready'
      ? 'text-emerald-400'
      : phase.kind === 'holding'
        ? 'text-amber-400'
        : 'text-zinc-100'

  const hint =
    phase.kind === 'idle'
      ? 'Scramble, then hold here'
      : phase.kind === 'holding'
        ? 'Keep holding…'
        : phase.kind === 'ready'
          ? 'Release to start'
          : running
            ? 'Tap anywhere to stop'
            : 'Attempt recorded'

  return (
    <Shell poolSize={pool.length}>
      {!running && !stopped && (
        <div className="flex-none px-4 pt-3">
          <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
              Scramble
            </div>
            <div
              className="font-mono text-sm leading-relaxed text-zinc-200 break-words"
              data-testid="drill-scramble"
            >
              {scramble.scramble}
            </div>
          </div>
        </div>
      )}

      {/* The timer: a large target that never scrolls the page or selects text. */}
      <div
        data-testid="drill-timer"
        role="button"
        tabIndex={0}
        aria-label="Timer. Hold to ready, release to start, tap to stop."
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={cancel}
        onPointerLeave={cancel}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none', WebkitUserSelect: 'none', userSelect: 'none' }}
        className="flex-1 min-h-[44px] flex flex-col items-center justify-center gap-2 px-4 cursor-pointer select-none"
      >
        <div
          className={`font-mono text-6xl font-extrabold tabular-nums tracking-tight transition-colors ${timerColour}`}
          aria-live="polite"
          data-testid="drill-time"
        >
          {formatMs(stopped ? phase.ms : elapsed)}
        </div>
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          {hint}
        </div>
      </div>

      {stopped && (
        <div className="flex-none px-4 pb-2 overflow-y-auto" data-testid="drill-reveal">
          <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  Set {c.set} • {c.group}
                </div>
                <h2
                  className="text-xl font-extrabold text-zinc-100 tracking-tight truncate"
                  data-testid="drill-case-name"
                >
                  {c.displayName}
                </h2>
              </div>
              <div className="flex-none w-20 h-20 rounded-xl bg-zinc-950/60 border border-zinc-800/60 p-1.5 flex items-center justify-center">
                {/* facelets[servedAuf], not facelets[0]: the orientation in the hands. */}
                <LLDiagram
                  facelets={c.facelets[servedAuf]}
                  className="w-full h-full"
                  label={`${c.displayName} at the served AUF`}
                />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                Algorithm
              </div>
              <div
                className="font-mono text-base font-bold text-zinc-100 break-words select-text"
                data-testid="drill-alg"
              >
                {revealed}
              </div>
            </div>

            <div className="font-mono text-[11px] text-zinc-500 break-words">
              {scramble.scramble}
            </div>
          </div>
        </div>
      )}

      <div className="flex-none px-4 pt-2 pb-4 flex flex-col gap-2">
        {note && (
          <p className="text-xs text-amber-400 text-center" role="status">
            {note}
          </p>
        )}
        <div className="flex gap-2">
          <button
            onClick={nextScramble}
            disabled={running}
            className="flex-1 h-12 rounded-xl bg-zinc-100 text-zinc-950 text-sm font-semibold disabled:opacity-30 active:scale-[0.98] transition-all"
          >
            {stopped ? 'Next case' : 'Skip'}
          </button>
          <button
            onClick={handleDiscard}
            disabled={running}
            className="h-12 px-5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-semibold text-zinc-300 disabled:opacity-30 active:scale-[0.98] transition-all"
          >
            Discard
          </button>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children, poolSize }: { children: React.ReactNode; poolSize?: number }) {
  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-50 select-none overflow-hidden">
      <header className="flex-none h-14 border-b border-zinc-900 flex items-center justify-between px-4">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
          Drill
        </h1>
        {poolSize !== undefined && (
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/50 px-2.5 py-1 rounded-lg border border-zinc-800/40">
            {poolSize} in pool
          </div>
        )}
      </header>
      {children}
    </div>
  )
}

export default DrillView
