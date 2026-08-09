import { useCallback, useEffect, useRef, useState } from 'react'
import { ALG_SET_BY_ID, CASES_BY_ID, SCRAMBLES, casesInAlgSet, groupsInAlgSet } from '@/data'
import type { AlgSetId, CaseSubset, Scramble, TrainerCase } from '@/data/types'
import { CaseDiagram } from '@/components/CaseDiagram'
import { revealAlgorithm } from '@/drill/reveal'
import {
  addAttempt,
  allProgress,
  allAttempts,
  chosenAlg,
  discardLastAttempt,
  type ProgressRecord,
  type AttemptRecord,
} from '@/storage/db'
import { statsByCase, slowestCases } from '@/stats'

const HOLD_MS = 300

type Phase =
  | { kind: 'idle' }
  | { kind: 'holding' }
  | { kind: 'ready' }
  | { kind: 'running'; startedAt: number }
  | { kind: 'stopped'; ms: number }

interface Served {
  c: TrainerCase
  scramble: Scramble
}

/**
 * The pool filter, always read within one algorithm set — the set itself is
 * chosen above the tab bar, not here. `subset` was called `set` while ZBLL was
 * the only set; `readFilter` migrates the stored shape.
 */
export interface DrillFilter {
  type: 'all' | 'subset' | 'group' | 'slowest'
  subset: CaseSubset
  group: string
}

const FILTER_KEY = 'lock-in-filter'

function defaultFilter(algSet: AlgSetId): DrillFilter {
  return {
    type: 'all',
    subset: ALG_SET_BY_ID.get(algSet)?.subsets[0] ?? '',
    group: groupsInAlgSet(algSet)[0] ?? '',
  }
}

/**
 * Reads the stored filter and makes it valid for the set in hand. A subset or
 * group that belongs to another set would otherwise silently produce an empty
 * pool, which reads as "you have ticked nothing" rather than "wrong filter".
 */
export function readFilter(raw: string | null, algSet: AlgSetId): DrillFilter {
  const fallback = defaultFilter(algSet)
  if (!raw) return fallback

  let parsed: Record<string, unknown>
  try {
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return fallback
    parsed = value as Record<string, unknown>
  } catch {
    return fallback
  }

  // 'set' was this filter's name for what is now a subset.
  const rawType = parsed.type === 'set' ? 'subset' : parsed.type
  const type: DrillFilter['type'] =
    rawType === 'all' || rawType === 'subset' || rawType === 'group' || rawType === 'slowest'
      ? rawType
      : 'all'

  const storedSubset = parsed.subset ?? parsed.set
  const subsets = ALG_SET_BY_ID.get(algSet)?.subsets ?? []
  const subset =
    typeof storedSubset === 'string' && subsets.includes(storedSubset)
      ? storedSubset
      : fallback.subset

  const group =
    typeof parsed.group === 'string' && groupsInAlgSet(algSet).includes(parsed.group)
      ? parsed.group
      : fallback.group

  return { type, subset, group }
}

function pick<T>(items: readonly T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.min(items.length - 1, Math.floor(Math.random() * items.length))]
}

function getFilteredPool(
  algSet: AlgSetId,
  progress: Map<string, ProgressRecord>,
  attempts: AttemptRecord[],
  filter: DrillFilter,
): TrainerCase[] {
  const ticked = casesInAlgSet(algSet).filter(
    (c) => progress.get(c.id)?.learned === true && (SCRAMBLES[c.id]?.length ?? 0) > 0,
  )

  if (filter.type === 'all') {
    return ticked
  }
  if (filter.type === 'subset') {
    return ticked.filter((c) => c.subset === filter.subset)
  }
  if (filter.type === 'group') {
    return ticked.filter((c) => c.group === filter.group)
  }
  if (filter.type === 'slowest') {
    const stats = statsByCase(attempts)
    const tickedIds = ticked.map((c) => c.id)
    const slowestIds = slowestCases(tickedIds, stats)
    const slowestSet = new Set(slowestIds)
    return ticked.filter((c) => slowestSet.has(c.id))
  }
  return ticked
}

function serveFrom(pool: readonly TrainerCase[]): Served | null {
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

const spokenMs = (ms: number): string => (ms < 60_000 ? `${formatMs(ms)}s` : formatMs(ms))

export interface DrillViewProps {
  algSet: AlgSetId
  onGoToBrowse?: () => void
}

export function DrillView({ algSet, onGoToBrowse }: DrillViewProps) {
  const [progress, setProgress] = useState<Map<string, ProgressRecord>>(new Map())
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [pool, setPool] = useState<TrainerCase[] | null>(null)
  const [served, setServed] = useState<Served | null>(null)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [elapsed, setElapsed] = useState(0)
  const [note, setNote] = useState<string | null>(null)

  const [filter, setFilter] = useState<DrillFilter>(() => defaultFilter(algSet))
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const holdTimer = useRef<number | null>(null)

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    Promise.all([allProgress(), allAttempts()])
      .then(([p, a]) => {
        if (cancelled) return
        setProgress(p)
        setAttempts(a)

        const initialFilter = readFilter(localStorage.getItem(FILTER_KEY), algSet)
        setFilter(initialFilter)

        const nextPool = getFilteredPool(algSet, p, a, initialFilter)
        setPool(nextPool)
        setServed(serveFrom(nextPool))
      })
      .catch((err: unknown) => {
        console.error('Failed to load progress or attempts:', err)
        if (!cancelled) setPool([])
      })
    return () => {
      cancelled = true
    }
  }, [algSet])

  useEffect(() => {
    if (pool !== null) {
      const nextPool = getFilteredPool(algSet, progress, attempts, filter)
      setPool(nextPool)
    }
  }, [algSet, progress, attempts, filter])

  useEffect(() => {
    let wakeLock: any = null
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen')
        }
      } catch (err) {
        console.warn('Wake Lock request failed:', err)
      }
    }

    requestWakeLock()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (wakeLock) {
        wakeLock.release().catch((err: any) => {
          console.warn('Wake Lock release failed:', err)
        })
      }
    }
  }, [])

  useEffect(() => clearHold, [clearHold])

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
    addAttempt({ caseId: served.c.id, ms, at, auf: served.scramble.auf })
      .then((insertedId) => {
        const newAttempt: AttemptRecord = {
          id: insertedId,
          caseId: served.c.id,
          ms,
          at,
          auf: served.scramble.auf,
        }
        setAttempts((prev) => [...prev, newAttempt])
      })
      .catch((err: unknown) => {
        console.error('Failed to record attempt:', err)
        setNote('Could not save that attempt.')
      })
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
      if (removed.id !== undefined) {
        setAttempts((prev) => prev.filter((a) => a.id !== removed.id))
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

  const handleFilterTypeChange = (type: DrillFilter['type']) => {
    const nextFilter = { ...filter, type }
    setFilter(nextFilter)
    localStorage.setItem(FILTER_KEY, JSON.stringify(nextFilter))
    const nextPool = getFilteredPool(algSet, progress, attempts, nextFilter)
    setPool(nextPool)
    setServed(serveFrom(nextPool))
  }

  const handleFilterSubsetChange = (subset: CaseSubset) => {
    const nextFilter = { ...filter, subset }
    setFilter(nextFilter)
    localStorage.setItem(FILTER_KEY, JSON.stringify(nextFilter))
    const nextPool = getFilteredPool(algSet, progress, attempts, nextFilter)
    setPool(nextPool)
    setServed(serveFrom(nextPool))
  }

  const handleFilterGroupChange = (group: string) => {
    const nextFilter = { ...filter, group }
    setFilter(nextFilter)
    localStorage.setItem(FILTER_KEY, JSON.stringify(nextFilter))
    const nextPool = getFilteredPool(algSet, progress, attempts, nextFilter)
    setPool(nextPool)
    setServed(serveFrom(nextPool))
  }

  const running = phase.kind === 'running'
  const stopped = phase.kind === 'stopped'

  const subsets = ALG_SET_BY_ID.get(algSet)?.subsets ?? []
  const groups = groupsInAlgSet(algSet)
  // A set with no subsets of its own has nothing to offer here, so the tab is
  // dropped rather than shown leading to an empty dropdown.
  const filterTypes: DrillFilter['type'][] =
    subsets.length > 0 ? ['all', 'subset', 'group', 'slowest'] : ['all', 'group', 'slowest']

  const headerActions = (
    <button
      onClick={() => setShowFilterPanel(!showFilterPanel)}
      disabled={running}
      aria-label="Toggle drill pool filter panel"
      className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all active:scale-95 border ${
        showFilterPanel
          ? 'bg-zinc-100 text-zinc-950 border-zinc-100 shadow-sm'
          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
      }`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
        />
      </svg>
    </button>
  )

  if (pool === null) {
    return (
      <Shell headerActions={headerActions}>
        <div className="flex-1 flex items-center justify-center text-sm text-zinc-500">
          Loading your pool…
        </div>
      </Shell>
    )
  }

  return (
    <Shell poolSize={pool.length} headerActions={headerActions}>
      {showFilterPanel && (
        <div className="flex-none bg-zinc-900 border-b border-zinc-850/80 p-4 flex flex-col gap-4 animate-in slide-in-from-top duration-200 z-30 relative" data-testid="drill-filter-panel">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">
              Pool Filter
            </label>
            <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800/60 w-full h-11">
              {filterTypes.map((type) => {
                const active = filter.type === type
                const labels: Record<DrillFilter['type'], string> = {
                  all: 'All',
                  subset: 'Subset',
                  group: 'Group',
                  slowest: 'Slowest 15',
                }
                return (
                  <button
                    key={type}
                    onClick={() => handleFilterTypeChange(type)}
                    data-testid={`filter-type-${type}`}
                    className={`flex-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                      active ? 'bg-zinc-100 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {labels[type]}
                  </button>
                )
              })}
            </div>
          </div>

          {filter.type === 'subset' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">
                Choose Subset
              </label>
              <select
                value={filter.subset}
                onChange={(e) => handleFilterSubsetChange(e.target.value)}
                data-testid="filter-subset-select"
                className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-semibold text-zinc-100 focus:outline-none focus:border-zinc-700"
              >
                {subsets.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          {filter.type === 'group' && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block mb-2">
                Choose Group
              </label>
              <select
                value={filter.group}
                onChange={(e) => handleFilterGroupChange(e.target.value)}
                data-testid="filter-group-select"
                className="w-full h-11 px-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-semibold text-zinc-100 focus:outline-none focus:border-zinc-700"
              >
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {pool.length === 0 || !served ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 px-6" data-testid="drill-empty-state">
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
            {filter.type === 'all'
              ? 'The drill pool is empty. Go to Browse and tick a case to start drilling it.'
              : filter.type === 'slowest'
                ? 'No ticked cases have attempts yet to calculate worst medians.'
                : `No ticked cases found for the chosen ${filter.type === 'subset' ? 'Subset' : 'Group'}.`}
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
      ) : (
        <>
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
                  {served.scramble.scramble}
                </div>
              </div>
            </div>
          )}

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
              className={`font-mono text-6xl font-extrabold tabular-nums tracking-tight transition-colors ${
                phase.kind === 'ready'
                  ? 'text-emerald-400'
                  : phase.kind === 'holding'
                    ? 'text-amber-400'
                    : 'text-zinc-100'
              }`}
              aria-live="polite"
              data-testid="drill-time"
            >
              {formatMs(stopped ? phase.ms : elapsed)}
            </div>
            <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
              {phase.kind === 'idle'
                ? 'Scramble, then hold here'
                : phase.kind === 'holding'
                  ? 'Keep holding…'
                  : phase.kind === 'ready'
                    ? 'Release to start'
                    : running
                      ? 'Tap anywhere to stop'
                      : 'Attempt recorded'}
            </div>
          </div>

          {stopped && (
            <div className="flex-none px-4 pb-2 overflow-y-auto" data-testid="drill-reveal">
              <div className="rounded-2xl bg-zinc-900/50 border border-zinc-800/80 p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                      {served.c.subset ? `${served.c.subset} • ` : ''}{served.c.group}
                    </div>
                    <h2
                      className="text-xl font-extrabold text-zinc-100 tracking-tight truncate"
                      data-testid="drill-case-name"
                    >
                      {served.c.displayName}
                    </h2>
                  </div>
                  <div className="flex-none w-20 h-20 rounded-xl bg-zinc-950/60 border border-zinc-800/60 p-1.5 flex items-center justify-center">
                    <CaseDiagram
                      algSet={served.c.algSet}
                      facelets={served.c.facelets[served.scramble.auf]}
                      className="w-full h-full"
                      label={`${served.c.displayName} at the served AUF`}
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
                    {revealAlgorithm(chosenAlg(served.c.algs, progress.get(served.c.id)), served.scramble.auf)}
                  </div>
                </div>

                <div className="font-mono text-[11px] text-zinc-500 break-words">
                  {served.scramble.scramble}
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
        </>
      )}
    </Shell>
  )
}

function Shell({
  children,
  poolSize,
  headerActions,
}: {
  children: React.ReactNode
  poolSize?: number
  headerActions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-50 select-none overflow-hidden">
      <header className="flex-none h-14 border-b border-zinc-900 flex items-center justify-between px-4">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
          Drill
        </h1>
        <div className="flex items-center gap-2">
          {headerActions}
          {poolSize !== undefined && (
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/50 px-2.5 py-1 rounded-lg border border-zinc-800/40">
              {poolSize} in pool
            </div>
          )}
        </div>
      </header>
      {children}
    </div>
  )
}

export default DrillView
