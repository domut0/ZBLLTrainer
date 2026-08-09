import type { AlgSetDef, AlgSetId } from '@/data'

export interface AlgSetPickerProps {
  sets: readonly AlgSetDef[]
  value: AlgSetId
  onChange: (next: AlgSetId) => void
}

/**
 * The algorithm-set switch, sitting directly above the tab bar so it reads as
 * scoping every tab rather than belonging to one.
 *
 * Renders even when only one set is registered. A picker that appears the day a
 * second set lands is a picker nobody notices; showing it from the start makes
 * "which set am I looking at" a permanent part of the screen.
 */
export function AlgSetPicker({ sets, value, onChange }: AlgSetPickerProps) {
  return (
    <div
      role="tablist"
      aria-label="Algorithm set"
      data-testid="alg-set-picker"
      className="flex-none border-t border-zinc-900/80 bg-zinc-950 px-3 pt-2 flex gap-2 overflow-x-auto"
    >
      {sets.map((s) => {
        const active = s.id === value
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={active}
            title={s.blurb}
            onClick={() => onChange(s.id)}
            data-testid={`alg-set-${s.id}`}
            className={`flex-none h-8 px-3.5 rounded-lg text-xs font-bold tracking-wide transition-all active:scale-95 border ${
              active
                ? 'bg-zinc-100 text-zinc-950 border-zinc-100'
                : 'bg-zinc-900/60 text-zinc-400 border-zinc-800'
            }`}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}
