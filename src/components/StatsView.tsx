import { useState, useEffect, useMemo } from 'react'
import { CASES } from '@/data'
import { allAttempts, type AttemptRecord } from '@/storage/db'
import { statsByCase, formatMs } from '@/stats'

export function StatsView() {
  const [attempts, setAttempts] = useState<AttemptRecord[]>([])
  const [sortBy, setSortBy] = useState<'case' | 'attempts' | 'median'>('median')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    allAttempts().then((a) => {
      setAttempts(a)
    })
  }, [])

  const statsMap = useMemo(() => statsByCase(attempts), [attempts])

  const sortedCases = useMemo(() => {
    const filtered = CASES.filter((c) => {
      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      return (
        c.displayName.toLowerCase().includes(q) ||
        c.set.toLowerCase().includes(q) ||
        c.group.toLowerCase().includes(q)
      )
    })

    return filtered.sort((a, b) => {
      const statA = statsMap.get(a.id)
      const statB = statsMap.get(b.id)

      const attemptsA = statA?.attempts ?? 0
      const attemptsB = statB?.attempts ?? 0

      const medianA = statA?.medianMs
      const medianB = statB?.medianMs

      if (sortBy === 'case') {
        const comp = a.displayName.localeCompare(b.displayName)
        return sortDir === 'asc' ? comp : -comp
      }

      if (sortBy === 'attempts') {
        if (attemptsA !== attemptsB) {
          return sortDir === 'asc' ? attemptsA - attemptsB : attemptsB - attemptsA
        }
        return a.displayName.localeCompare(b.displayName)
      }

      if (sortBy === 'median') {
        if (medianA === undefined && medianB === undefined) {
          return a.displayName.localeCompare(b.displayName)
        }
        if (medianA === undefined) return 1
        if (medianB === undefined) return -1

        return sortDir === 'asc' ? medianA - medianB : medianB - medianA
      }

      return 0
    })
  }, [statsMap, sortBy, sortDir, searchQuery])

  const toggleSort = (field: 'case' | 'attempts' | 'median') => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir(field === 'median' ? 'desc' : 'asc')
    }
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-50 select-none">
      <header className="flex-none h-14 border-b border-zinc-900 flex items-center justify-between px-4 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 via-pink-400 to-amber-300 bg-clip-text text-transparent">
          Stats
        </h1>
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-zinc-900/50 px-2.5 py-1 rounded-lg border border-zinc-800/40">
          Cases
        </div>
      </header>

      {/* Search Filter */}
      <div className="flex-none p-4 border-b border-zinc-900 bg-zinc-950/50">
        <div className="relative">
          <input
            type="text"
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-11 pl-10 pr-4 bg-zinc-900/60 border border-zinc-800 rounded-xl text-sm font-semibold text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 transition-colors"
          />
          <div className="absolute left-3.5 top-3 text-zinc-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 h-5 w-5 flex items-center justify-center"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Table Headers */}
      <div className="flex-none px-4 py-2 border-b border-zinc-900 bg-zinc-950/80 flex text-[10px] font-bold uppercase tracking-widest text-zinc-500">
        <button
          onClick={() => toggleSort('case')}
          data-testid="sort-case-button"
          className="flex-1 text-left flex items-center gap-1 h-9 hover:text-zinc-300 focus:outline-none"
        >
          Case {sortBy === 'case' && (sortDir === 'asc' ? '▲' : '▼')}
        </button>
        <button
          onClick={() => toggleSort('attempts')}
          data-testid="sort-attempts-button"
          className="w-24 text-right flex items-center justify-end gap-1 h-9 hover:text-zinc-300 focus:outline-none"
        >
          Attempts {sortBy === 'attempts' && (sortDir === 'asc' ? '▲' : '▼')}
        </button>
        <button
          onClick={() => toggleSort('median')}
          data-testid="sort-median-button"
          className="w-24 text-right flex items-center justify-end gap-1 h-9 hover:text-zinc-300 focus:outline-none"
        >
          Median {sortBy === 'median' && (sortDir === 'asc' ? '▲' : '▼')}
        </button>
      </div>

      {/* Table Body */}
      <div className="flex-1 overflow-y-auto px-4 divide-y divide-zinc-900/60">
        {sortedCases.map((c) => {
          const stat = statsMap.get(c.id)
          const attemptCount = stat?.attempts ?? 0
          const med = stat?.medianMs !== undefined ? formatMs(stat.medianMs) : '-'

          return (
            <div
              key={c.id}
              data-testid="stats-row"
              className="py-3.5 flex items-center text-sm font-semibold text-zinc-200"
            >
              <div className="flex-1 text-left min-w-0 pr-2">
                <div className="text-zinc-100 truncate" data-testid="stats-case-name">
                  {c.displayName}
                </div>
                <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wide truncate">
                  {c.set} • {c.group}
                </div>
              </div>
              <div className="w-24 text-right font-mono text-zinc-400" data-testid="stats-attempts">
                {attemptCount}
              </div>
              <div className="w-24 text-right font-mono text-zinc-100" data-testid="stats-median">
                {med}
              </div>
            </div>
          )
        })}
        {sortedCases.length === 0 && (
          <div className="text-center py-8 text-sm text-zinc-500">
            No matching cases.
          </div>
        )}
      </div>
    </div>
  )
}

export default StatsView
