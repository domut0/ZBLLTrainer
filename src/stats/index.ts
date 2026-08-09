import type { AttemptRecord } from '@/storage/db'

/**
 * Derived statistics. Nothing here is stored — every figure is computed from
 * the attempt rows on read (PRD §6). Maintaining running aggregates alongside
 * the raw attempts would mean two sources of truth that can drift, and discard
 * would have to unwind them.
 */

/** How many recent attempts a median is taken over. */
export const MEDIAN_WINDOW = 12

/** How many cases "slowest fifteen" mode drills. */
export const SLOWEST_N = 15

export interface CaseStats {
  caseId: string
  attempts: number
  /**
   * Median of the last `MEDIAN_WINDOW` attempts, in milliseconds, or undefined
   * when the case has never been attempted. Undefined is not zero, and the
   * table must not render it as one.
   */
  medianMs?: number
  /** Epoch ms of the most recent attempt. */
  lastAt?: number
}

/**
 * Median, not mean. A single blank-out is a 9-second attempt against a
 * 2-second case, and a mean would let it define that case for a long time.
 */
export function median(values: readonly number[]): number | undefined {
  if (!values.length) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function statsByCase(attempts: readonly AttemptRecord[]): Map<string, CaseStats> {
  const byCase = new Map<string, AttemptRecord[]>()
  for (const a of attempts) {
    const list = byCase.get(a.caseId)
    if (list) list.push(a)
    else byCase.set(a.caseId, [a])
  }

  const out = new Map<string, CaseStats>()
  for (const [caseId, list] of byCase) {
    const chronological = [...list].sort((a, b) => a.at - b.at)
    const recent = chronological.slice(-MEDIAN_WINDOW)
    out.set(caseId, {
      caseId,
      attempts: chronological.length,
      medianMs: median(recent.map((a) => a.ms)),
      lastAt: chronological[chronological.length - 1]?.at,
    })
  }
  return out
}

/**
 * The pool for slowest-N mode, worst first.
 *
 * A case with no attempts has no median and cannot be ranked, but it is also
 * the case you know least about — so unattempted cases fill any remaining
 * slots after the ranked ones, rather than being excluded. Without that, this
 * mode returns nothing at all until you have drilled the pool once, which is
 * exactly when you would first reach for it.
 */
export function slowestCases(
  poolIds: readonly string[],
  stats: ReadonlyMap<string, CaseStats>,
  n: number = SLOWEST_N,
): string[] {
  const withMedian: CaseStats[] = []
  const unattempted: string[] = []
  for (const id of poolIds) {
    const s = stats.get(id)
    if (s?.medianMs === undefined) unattempted.push(id)
    else withMedian.push(s)
  }
  withMedian.sort((a, b) => (b.medianMs ?? 0) - (a.medianMs ?? 0))
  return [...withMedian.map((s) => s.caseId), ...unattempted].slice(0, n)
}

/** Milliseconds as the app shows them: 2.47, 12.10. */
export function formatMs(ms: number): string {
  return (ms / 1000).toFixed(2)
}
