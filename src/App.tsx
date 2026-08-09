import { useEffect, useState } from 'react'
import { BrowseView } from '@/components/BrowseView'
import { DrillView } from '@/components/DrillView'
import { StatsView } from '@/components/StatsView'
import { SettingsView } from '@/components/SettingsView'
import { AlgSetPicker } from '@/components/AlgSetPicker'
import { ALG_SETS, asAlgSetId, DEFAULT_ALG_SET, type AlgSetId } from '@/data'

type Tab = 'browse' | 'drill' | 'stats' | 'settings'

const ALG_SET_KEY = 'lock-in-alg-set'

/**
 * The chosen algorithm set lives here rather than in each view, because browse,
 * drill and stats must agree on it: ticking a case in one set and finding the
 * drill still serving another would be baffling.
 */
export default function App() {
  const [tab, setTab] = useState<Tab>('browse')
  const [algSet, setAlgSet] = useState<AlgSetId>(DEFAULT_ALG_SET)

  useEffect(() => {
    setAlgSet(asAlgSetId(localStorage.getItem(ALG_SET_KEY)))
  }, [])

  const chooseAlgSet = (next: AlgSetId) => {
    setAlgSet(next)
    localStorage.setItem(ALG_SET_KEY, next)
  }

  return (
    <div className="w-full max-w-md mx-auto h-full flex flex-col bg-zinc-950 shadow-2xl relative overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'browse' && <BrowseView algSet={algSet} />}
        {tab === 'drill' && <DrillView algSet={algSet} onGoToBrowse={() => setTab('browse')} />}
        {tab === 'stats' && <StatsView algSet={algSet} />}
        {tab === 'settings' && <SettingsView />}
      </div>

      {tab !== 'settings' && (
        <AlgSetPicker sets={ALG_SETS} value={algSet} onChange={chooseAlgSet} />
      )}

      <nav className="flex-none border-t border-zinc-900 bg-zinc-950/95 backdrop-blur-md px-3 py-2 flex gap-2">
        {(['browse', 'drill', 'stats', 'settings'] as Tab[]).map((t) => {
          const active = tab === t
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 h-12 rounded-xl text-sm font-semibold capitalize transition-all active:scale-[0.98] ${
                active
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'bg-zinc-900/60 border border-zinc-800 text-zinc-400'
              }`}
            >
              {t}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
