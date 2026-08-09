import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ALG_SET_BY_ID,
  casesInAlgSet,
  casesInSubset,
  groupsInSubset,
  type AlgSetId,
  type CaseSubset,
  type TrainerCase,
} from '@/data'
import { allProgress, toggleLearned, DEFAULT_PROGRESS, type ProgressRecord } from '@/storage/db'
import { CaseDiagram } from '@/components/CaseDiagram'
import { CaseDetail } from '@/components/CaseDetail'

/**
 * Browse is scoped to one algorithm set, chosen above the tab bar. Within a set
 * it descends subsets → groups → cases → detail. A set with no subsets of its
 * own starts at groups instead, so the user is never shown a list of one.
 */
type NavState =
  | { type: 'subsets' }
  | { type: 'groups'; subset: CaseSubset }
  | { type: 'cases'; subset: CaseSubset; group: string }
  | { type: 'detail'; subset: CaseSubset; group: string; caseId: string }

type FilterMode = 'all' | 'ticked' | 'unticked'

export interface BrowseViewProps {
  algSet: AlgSetId
}

export function BrowseView({ algSet }: BrowseViewProps) {
  const def = ALG_SET_BY_ID.get(algSet)
  const subsets = def?.subsets ?? []
  const hasSubsets = subsets.length > 0

  const rootNav: NavState = hasSubsets ? { type: 'subsets' } : { type: 'groups', subset: '' }

  const [nav, setNav] = useState<NavState>(rootNav)
  const [progress, setProgress] = useState<Map<string, ProgressRecord>>(new Map())
  const [filterMode, setFilterMode] = useState<FilterMode>('all')

  const mainRef = useRef<HTMLDivElement>(null)

  // Switching sets mid-browse would otherwise leave the nav pointing at a
  // subset the new set does not have.
  useEffect(() => {
    setNav(hasSubsets ? { type: 'subsets' } : { type: 'groups', subset: '' })
  }, [algSet, hasSubsets])

  // Scroll to top when view changes
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0
    }
  }, [nav])

  // Fetch all progress records from IndexedDB on mount
  useEffect(() => {
    allProgress().then((p) => {
      setProgress(p)
    })
  }, [])

  // Optimistic update of learned state
  const handleToggleLearned = async (caseId: string) => {
    setProgress((prev) => {
      const next = new Map(prev)
      const current = next.get(caseId) || DEFAULT_PROGRESS(caseId)
      next.set(caseId, { ...current, learned: !current.learned })
      return next
    })

    try {
      await toggleLearned(caseId)
    } catch (err) {
      console.error('Failed to toggle learned state in DB:', err)
      // Rollback on failure
      const freshProgress = await allProgress()
      setProgress(freshProgress)
    }
  }

  // Ticked and total counts per subset, per group, and across the whole set.
  const stats = useMemo(() => {
    const subsetCounts: Record<string, { total: number; ticked: number }> = {}
    for (const s of subsets) subsetCounts[s] = { total: 0, ticked: 0 }

    const groupCounts: Record<string, { total: number; ticked: number }> = {}

    let totalTotal = 0
    let totalTicked = 0

    for (const c of casesInAlgSet(algSet)) {
      const isTicked = !!progress.get(c.id)?.learned

      subsetCounts[c.subset] ??= { total: 0, ticked: 0 }
      subsetCounts[c.subset].total++
      if (isTicked) subsetCounts[c.subset].ticked++

      groupCounts[c.group] ??= { total: 0, ticked: 0 }
      groupCounts[c.group].total++
      if (isTicked) groupCounts[c.group].ticked++

      totalTotal++
      if (isTicked) totalTicked++
    }

    return { subsetCounts, groupCounts, totalTotal, totalTicked }
  }, [progress, algSet, subsets])

  // Group list for the current subset, in source-sheet order.
  const groups = useMemo(
    () => (nav.type === 'subsets' ? [] : groupsInSubset(algSet, nav.subset)),
    [algSet, nav],
  )

  const setLabel = def?.label ?? algSet

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-50 select-none">
      {/* Top Header */}
      <header className="flex-none h-14 border-b border-zinc-900 flex items-center justify-between px-4 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
          {nav.type === 'subsets' && `Lock In ${setLabel}`}
          {nav.type === 'groups' && (nav.subset ? `${setLabel} ${nav.subset}` : setLabel)}
          {nav.type === 'cases' && nav.group}
          {nav.type === 'detail' && nav.group}
        </h1>
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/50 px-2.5 py-1 rounded-lg border border-zinc-800/40">
          {nav.type === 'subsets' && 'Subsets'}
          {nav.type === 'groups' && 'Groups'}
          {nav.type === 'cases' && 'Grid'}
          {nav.type === 'detail' && 'Detail'}
        </div>
      </header>

      {/* Main Content Area */}
      <main ref={mainRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 pb-6">
        {nav.type === 'subsets' && (
          <div className="grid grid-cols-2 gap-4">
            {subsets.map((subset, i) => {
              const count = stats.subsetCounts[subset] ?? { total: 0, ticked: 0 }
              const percent = count.total > 0 ? (count.ticked / count.total) * 100 : 0
              // An odd count leaves a gap; the last tile spans it.
              const isLast = i === subsets.length - 1 && subsets.length % 2 === 1

              return (
                <button
                  key={subset}
                  onClick={() => setNav({ type: 'groups', subset })}
                  className={`flex flex-col justify-between p-4 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 active:scale-95 transition-all text-left min-h-[110px] ${
                    isLast ? 'col-span-2' : ''
                  }`}
                  aria-label={`Subset ${subset}, ${count.ticked} of ${count.total} cases learned`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span className="text-3xl font-extrabold tracking-tight text-zinc-100">
                      {subset}
                    </span>
                    <span className="text-xs font-semibold text-zinc-400 bg-zinc-900/80 px-2 py-1 rounded-lg border border-zinc-800">
                      {count.ticked}/{count.total}
                    </span>
                  </div>
                  <div className="w-full mt-4">
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {nav.type === 'groups' && (
          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const count = stats.groupCounts[group] || { total: 0, ticked: 0 }
              const percent = count.total > 0 ? (count.ticked / count.total) * 100 : 0

              return (
                <button
                  key={group}
                  onClick={() => setNav({ type: 'cases', subset: nav.subset, group })}
                  className="flex flex-col p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 active:scale-[0.99] transition-all text-left"
                  aria-label={`Group ${group}, ${count.ticked} of ${count.total} cases learned`}
                >
                  <div className="flex justify-between items-center w-full mb-2">
                    <span className="text-sm font-semibold text-zinc-200">{group}</span>
                    <span className="text-xs font-medium text-zinc-400">
                      {count.ticked}/{count.total}
                    </span>
                  </div>
                  <div className="w-full">
                    <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-amber-400 rounded-full transition-all duration-300"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {nav.type === 'cases' && (
          <CaseGrid
            algSet={algSet}
            subset={nav.subset}
            group={nav.group}
            progress={progress}
            filterMode={filterMode}
            onToggleLearned={handleToggleLearned}
            onOpenDetail={(caseId) =>
              setNav({ type: 'detail', subset: nav.subset, group: nav.group, caseId })
            }
          />
        )}

        {nav.type === 'detail' &&
          (() => {
            const c = casesInAlgSet(algSet).find((x) => x.id === nav.caseId)
            if (!c) return null
            const p = progress.get(nav.caseId) || DEFAULT_PROGRESS(nav.caseId)
            return (
              <CaseDetail
                c={c}
                progress={p}
                onProgressChange={(nextRecord) => {
                  setProgress((prev) => {
                    const next = new Map(prev)
                    next.set(nav.caseId, nextRecord)
                    return next
                  })
                }}
                onBack={() => setNav({ type: 'cases', subset: nav.subset, group: nav.group })}
              />
            )
          })()}
      </main>

      {/* Bottom Sticky Control Panel */}
      {/* In flow rather than fixed: App now owns the bottom of the screen with
          the Browse/Drill tab bar, and a fixed footer would sit on top of it. */}
      <footer className="flex-none p-4 bg-zinc-950/95 border-t border-zinc-900/80 backdrop-blur-md z-20 flex flex-col gap-3">
        {nav.type === 'cases' && (
          <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800/60 w-full h-11">
            {(['all', 'ticked', 'unticked'] as FilterMode[]).map((mode) => {
              const active = filterMode === mode
              return (
                <button
                  key={mode}
                  onClick={() => setFilterMode(mode)}
                  className={`flex-1 text-xs font-semibold rounded-lg capitalize transition-all ${
                    active ? 'bg-zinc-100 text-zinc-950 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {mode}
                </button>
              )
            })}
          </div>
        )}

        {nav.type !== rootNav.type && (
          <button
            onClick={() => {
              if (nav.type === 'detail') {
                setNav({ type: 'cases', subset: nav.subset, group: nav.group })
              } else if (nav.type === 'cases') {
                setNav({ type: 'groups', subset: nav.subset })
              } else if (nav.type === 'groups') {
                setNav({ type: 'subsets' })
              }
            }}
            className="w-full h-12 flex items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm font-semibold text-zinc-200 active:scale-[0.98] transition-all"
          >
            <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back to {nav.type === 'detail' ? 'Grid' : nav.type === 'cases' ? 'Groups' : 'Subsets'}
          </button>
        )}

        {nav.type === rootNav.type && (
          <div className="flex flex-col gap-1 text-center py-1">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Overall Progress
            </div>
            <div className="text-lg font-bold text-zinc-300">
              {stats.totalTicked} / {stats.totalTotal} Learned
            </div>
            <div className="w-full mt-1.5 px-2">
              <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/40">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 rounded-full transition-all duration-300"
                  style={{
                    width: `${stats.totalTotal > 0 ? (stats.totalTicked / stats.totalTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}

interface CaseGridProps {
  algSet: AlgSetId
  subset: CaseSubset
  group: string
  progress: Map<string, ProgressRecord>
  filterMode: FilterMode
  onToggleLearned: (caseId: string) => void
  onOpenDetail: (caseId: string) => void
}

function CaseGrid({
  algSet,
  subset,
  group,
  progress,
  filterMode,
  onToggleLearned,
  onOpenDetail,
}: CaseGridProps) {
  const casesInGroup: readonly TrainerCase[] = useMemo(
    () => casesInSubset(algSet, subset).filter((c) => c.group === group),
    [algSet, subset, group],
  )

  const visibleCases = useMemo(() => {
    return casesInGroup.filter((c) => {
      const isTicked = !!progress.get(c.id)?.learned
      if (filterMode === 'ticked') return isTicked
      if (filterMode === 'unticked') return !isTicked
      return true
    })
  }, [casesInGroup, progress, filterMode])

  if (visibleCases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center p-8 min-h-[220px] rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/20">
        <span className="text-zinc-600 mb-2">
          <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 9h16.5m-16.5 6.75h16.5" />
          </svg>
        </span>
        <p className="text-sm font-medium text-zinc-400">No cases match the filter.</p>
        <p className="text-xs text-zinc-500 mt-1">Try switching to another filter tab below.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      {visibleCases.map((c) => {
        const isTicked = !!progress.get(c.id)?.learned

        return (
          <div key={c.id} className="relative aspect-square">
            <button
              onClick={() => onOpenDetail(c.id)}
              className={`w-full h-full flex flex-col items-center justify-center p-2 pt-6 rounded-xl border transition-all duration-150 active:scale-95 text-zinc-400 ${
                isTicked
                  ? 'border-emerald-500/70 bg-emerald-950/10 text-zinc-100 shadow-[0_0_12px_rgba(16,185,129,0.08)]'
                  : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700/60'
              }`}
              aria-label={`Case ${c.indexInGroup}, ${isTicked ? 'learned' : 'not learned'}`}
            >
              <span className="absolute top-2 left-2 text-[10px] font-extrabold tracking-tight text-zinc-500">
                #{c.indexInGroup}
              </span>
              <CaseDiagram algSet={c.algSet} facelets={c.facelets[0]} className="w-14 h-14" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleLearned(c.id)
              }}
              className="absolute top-0 right-0 w-11 h-11 flex items-center justify-center z-10"
              aria-label={`Toggle Case ${c.indexInGroup} learned state`}
            >
              {isTicked ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-zinc-950 flex items-center justify-center shadow-sm">
                  <svg className="w-3.5 h-3.5 stroke-[3.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-zinc-700 hover:border-zinc-500 bg-zinc-950/80 flex items-center justify-center transition-colors" />
              )}
            </button>
          </div>
        )
      })}
    </div>
  )
}
