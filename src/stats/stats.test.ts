import { describe, expect, it } from 'vitest'
import type { AttemptRecord } from '@/storage/db'
import { MEDIAN_WINDOW, formatMs, median, slowestCases, statsByCase } from './index'

const attempt = (caseId: string, ms: number, at: number): AttemptRecord => ({
  caseId,
  ms,
  at,
  auf: 0,
})

describe('median', () => {
  it('is undefined for no values, not zero', () => {
    expect(median([])).toBeUndefined()
  })

  it('takes the middle of an odd count and the mean of the middle two of an even one', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('is unmoved by a single blank-out, which is the reason it is not a mean', () => {
    const normal = [2000, 2100, 1900, 2050, 2000]
    const withBlank = [...normal, 9000]
    expect(median(withBlank)).toBeLessThan(2400)
  })

  it('does not mutate its input', () => {
    const values = [3, 1, 2]
    median(values)
    expect(values).toEqual([3, 1, 2])
  })
})

describe('statsByCase', () => {
  it('counts every attempt but medians only the last twelve', () => {
    const attempts: AttemptRecord[] = []
    // Twelve slow ones, then twelve fast ones.
    for (let i = 0; i < 12; i += 1) attempts.push(attempt('a', 5000, i))
    for (let i = 0; i < 12; i += 1) attempts.push(attempt('a', 1000, 100 + i))

    const s = statsByCase(attempts).get('a')!
    expect(s.attempts).toBe(24)
    expect(s.medianMs).toBe(1000)
  })

  it('uses the most recent by timestamp, not by insertion order', () => {
    const s = statsByCase([attempt('a', 5000, 999), attempt('a', 1000, 1)]).get('a')!
    expect(s.lastAt).toBe(999)
  })

  it('keeps cases separate and omits ones never attempted', () => {
    const stats = statsByCase([attempt('a', 1000, 1), attempt('b', 2000, 2)])
    expect(stats.get('a')?.medianMs).toBe(1000)
    expect(stats.get('b')?.medianMs).toBe(2000)
    expect(stats.get('c')).toBeUndefined()
  })

  it('windows at exactly MEDIAN_WINDOW', () => {
    expect(MEDIAN_WINDOW).toBe(12)
  })
})

describe('slowestCases', () => {
  const stats = statsByCase([
    attempt('slow', 5000, 1),
    attempt('mid', 3000, 2),
    attempt('fast', 1000, 3),
  ])

  it('ranks worst median first', () => {
    expect(slowestCases(['fast', 'mid', 'slow'], stats, 3)).toEqual(['slow', 'mid', 'fast'])
  })

  it('respects the pool: a case outside it never appears', () => {
    expect(slowestCases(['fast', 'mid'], stats, 3)).toEqual(['mid', 'fast'])
  })

  it('fills remaining slots with never-attempted cases', () => {
    // Otherwise this mode returns nothing until the pool has been drilled once,
    // which is exactly when you would first reach for it.
    expect(slowestCases(['fast', 'new'], stats, 3)).toEqual(['fast', 'new'])
  })

  it('honours n', () => {
    expect(slowestCases(['fast', 'mid', 'slow'], stats, 2)).toEqual(['slow', 'mid'])
  })

  it('is empty for an empty pool', () => {
    expect(slowestCases([], stats)).toEqual([])
  })
})

describe('formatMs', () => {
  it('shows hundredths', () => {
    expect(formatMs(2470)).toBe('2.47')
    expect(formatMs(12100)).toBe('12.10')
  })
})
