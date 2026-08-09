import { useState } from 'react'
import { BrowseView } from '@/components/BrowseView'
import { DrillView } from '@/components/DrillView'
import { StatsView } from '@/components/StatsView'
import { SettingsView } from '@/components/SettingsView'

type Tab = 'browse' | 'drill' | 'stats' | 'settings'

export default function App() {
  const [tab, setTab] = useState<Tab>('browse')

  return (
    <div className="w-full max-w-md mx-auto h-full flex flex-col bg-zinc-950 shadow-2xl relative overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === 'browse' && <BrowseView />}
        {tab === 'drill' && <DrillView onGoToBrowse={() => setTab('browse')} />}
        {tab === 'stats' && <StatsView />}
        {tab === 'settings' && <SettingsView />}
      </div>

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
