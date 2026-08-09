import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { DrillView } from './DrillView'
import { CASES, SCRAMBLES, FACELET_FILL, type FaceletColour } from '@/data'
import { chosenAlg, type AttemptRecord, type ProgressRecord } from '@/storage/db'
import { revealAlgorithm } from '@/drill/reveal'

/*
 * The point of this file is the AUF trap. Every case is served at a random AUF,
 * so both halves of the reveal have to follow the orientation actually served:
 * the algorithm through `revealAlgorithm`, and the diagram through
 * `facelets[servedAuf]`. Both are asserted against a NON-ZERO served AUF —
 * an AUF of 0 needs no correction and would pass with the correction deleted.
 *
 * `@/drill/reveal` is deliberately NOT mocked: it is the thing under test here,
 * via the component that has to call it. Only IndexedDB is stubbed out.
 */

const mockAllProgress = vi.fn<() => Promise<Map<string, ProgressRecord>>>()
const mockAddAttempt = vi.fn<(a: Omit<AttemptRecord, 'id'>) => Promise<number>>()
const mockDiscardLastAttempt = vi.fn<() => Promise<AttemptRecord | undefined>>()

vi.mock('@/storage/db', async (importOriginal) => {
  // `chosenAlg` is pure and is part of what we are asserting against, so keep
  // the real one. Only the three IndexedDB calls are replaced.
  const actual = await importOriginal<typeof import('@/storage/db')>()
  return {
    ...actual,
    allProgress: () => mockAllProgress(),
    allAttempts: vi.fn(async () => []),
    addAttempt: (a: Omit<AttemptRecord, 'id'>) => mockAddAttempt(a),
    discardLastAttempt: () => mockDiscardLastAttempt(),
  }
})

/**
 * A case whose reveal can actually catch a missing correction: at least two
 * algorithms (so `chosenAlg` matters), and a scramble at a non-zero AUF whose
 * diagram differs from the one at AUF 0.
 */
const testCase = CASES.find((c) => {
  if (c.algs.length < 2) return false
  return (SCRAMBLES[c.id] ?? []).some(
    (s) => s.auf !== 0 && c.facelets[s.auf] !== c.facelets[0],
  )
})!

const scrambleList = SCRAMBLES[testCase.id]
const servedIndex = scrambleList.findIndex(
  (s) => s.auf !== 0 && testCase.facelets[s.auf] !== testCase.facelets[0],
)
const served = scrambleList[servedIndex]
const servedAuf = served.auf

/** The progress record for the drilled case: ticked, and on its second algorithm. */
const learnedProgress: ProgressRecord = {
  caseId: testCase.id,
  learned: true,
  primaryAlgIndex: 1,
}

/**
 * The component picks uniformly with `Math.floor(Math.random() * length)`.
 * Returning the midpoint of a slot selects that slot unambiguously — and with
 * a one-case pool the same value always selects that case.
 */
function serveDeterministically(index: number) {
  vi.spyOn(Math, 'random').mockReturnValue((index + 0.5) / scrambleList.length)
}

const expectedFills = (facelets: string) =>
  [...facelets].map((ch) => FACELET_FILL[ch as FaceletColour])

/** Hold, wait for the arm, release to start, tap to stop. */
async function runOneAttempt() {
  const timer = screen.getByTestId('drill-timer')
  fireEvent.pointerDown(timer)
  await waitFor(() => expect(screen.getByText('Release to start')).toBeInTheDocument())
  fireEvent.pointerUp(timer)
  expect(screen.getByText('Tap anywhere to stop')).toBeInTheDocument()
  fireEvent.pointerDown(timer)
  return screen.findByTestId('drill-reveal')
}

describe('DrillView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAllProgress.mockResolvedValue(new Map([[testCase.id, learnedProgress]]))
    mockAddAttempt.mockResolvedValue(1)
    mockDiscardLastAttempt.mockResolvedValue(undefined)
    serveDeterministically(servedIndex)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('picked a case that can actually catch a missing AUF correction', () => {
    expect(servedAuf).not.toBe(0)
    expect(testCase.facelets[servedAuf]).not.toBe(testCase.facelets[0])
    expect(testCase.algs.length).toBeGreaterThan(1)
  })

  it('serves the scramble it selected', async () => {
    render(<DrillView />)
    const el = await screen.findByTestId('drill-scramble')
    expect(el).toHaveTextContent(served.scramble)
  })

  it('reveals the algorithm AUF-corrected for the served AUF', async () => {
    render(<DrillView />)
    await screen.findByTestId('drill-scramble')
    await runOneAttempt()

    const alg = chosenAlg(testCase.algs, learnedProgress)
    const expected = revealAlgorithm(alg, servedAuf)

    expect(screen.getByTestId('drill-alg')).toHaveTextContent(expected)

    // Negative controls: the stored string, and the reveal for an unserved
    // orientation, must both be wrong here. Without these the assertion above
    // would still pass if the served AUF were quietly ignored.
    expect(expected).not.toBe(alg.alg)
    expect(expected).not.toBe(revealAlgorithm(alg, 0))
    expect(screen.getByTestId('drill-alg').textContent).not.toBe(alg.alg)
    expect(screen.getByTestId('drill-alg').textContent).not.toBe(revealAlgorithm(alg, 0))
  })

  it('honours the chosen algorithm, not just the first one', async () => {
    render(<DrillView />)
    await screen.findByTestId('drill-scramble')
    await runOneAttempt()

    expect(chosenAlg(testCase.algs, learnedProgress)).toBe(testCase.algs[1])
    expect(screen.getByTestId('drill-alg')).toHaveTextContent(
      revealAlgorithm(testCase.algs[1], servedAuf),
    )
  })

  it('draws the diagram at the served AUF, not at facelets[0]', async () => {
    render(<DrillView />)
    await screen.findByTestId('drill-scramble')
    await runOneAttempt()

    const svg = screen.getByRole('img', {
      name: `${testCase.displayName} at the served AUF`,
    })
    const fills = Array.from(svg.querySelectorAll('rect')).map((r) => r.getAttribute('fill'))

    expect(fills).toEqual(expectedFills(testCase.facelets[servedAuf]))
    expect(fills).not.toEqual(expectedFills(testCase.facelets[0]))
  })

  it('records the attempt with the case id and the served AUF', async () => {
    render(<DrillView />)
    await screen.findByTestId('drill-scramble')
    await runOneAttempt()

    await waitFor(() => expect(mockAddAttempt).toHaveBeenCalledTimes(1))
    const attempt = mockAddAttempt.mock.calls[0][0]
    expect(attempt.caseId).toBe(testCase.id)
    expect(attempt.auf).toBe(servedAuf)
    expect(attempt.ms).toBeGreaterThanOrEqual(0)
    expect(attempt.at).toBeGreaterThan(0)
  })

  it('shows the case name and the time on the reveal', async () => {
    render(<DrillView />)
    await screen.findByTestId('drill-scramble')
    await runOneAttempt()

    expect(screen.getByTestId('drill-case-name')).toHaveTextContent(testCase.displayName)
    expect(screen.getByTestId('drill-time').textContent).toMatch(/^\d+\.\d{2}$/)
  })

  it('does not start the timer when the hold is released too early', async () => {
    render(<DrillView />)
    await screen.findByTestId('drill-scramble')

    const timer = screen.getByTestId('drill-timer')
    fireEvent.pointerDown(timer)
    expect(screen.getByText('Keep holding…')).toBeInTheDocument()
    fireEvent.pointerUp(timer)

    expect(screen.getByText('Scramble, then hold here')).toBeInTheDocument()
    expect(screen.queryByTestId('drill-reveal')).toBeNull()
    expect(mockAddAttempt).not.toHaveBeenCalled()
  })

  it('serves another scramble after the reveal', async () => {
    render(<DrillView />)
    await screen.findByTestId('drill-scramble')
    await runOneAttempt()

    const otherIndex = (servedIndex + 1) % scrambleList.length
    serveDeterministically(otherIndex)
    fireEvent.click(screen.getByRole('button', { name: 'Next case' }))

    expect(screen.queryByTestId('drill-reveal')).toBeNull()
    expect(await screen.findByTestId('drill-scramble')).toHaveTextContent(
      scrambleList[otherIndex].scramble,
    )
  })

  it('discards the most recent attempt and says what it removed', async () => {
    mockDiscardLastAttempt.mockResolvedValue({
      id: 7,
      caseId: testCase.id,
      ms: 3420,
      at: Date.now(),
      auf: servedAuf,
    })

    render(<DrillView />)
    await screen.findByTestId('drill-scramble')
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => expect(mockDiscardLastAttempt).toHaveBeenCalledTimes(1))
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('3.42s')
    expect(status).toHaveTextContent(testCase.displayName)
  })

  it('says so when there is nothing to discard', async () => {
    render(<DrillView />)
    await screen.findByTestId('drill-scramble')
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Nothing to discard.')
  })

  it('points at Browse instead of crashing when the pool is empty', async () => {
    mockAllProgress.mockResolvedValue(new Map())
    const onGoToBrowse = vi.fn()

    render(<DrillView onGoToBrowse={onGoToBrowse} />)

    expect(await screen.findByText('Nothing to drill yet')).toBeInTheDocument()
    expect(screen.getByText(/tick a case/i)).toBeInTheDocument()
    expect(screen.queryByTestId('drill-timer')).toBeNull()
    expect(screen.queryByTestId('drill-scramble')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Go to Browse' }))
    expect(onGoToBrowse).toHaveBeenCalledTimes(1)
  })

  it('treats an unticked case as out of the pool', async () => {
    mockAllProgress.mockResolvedValue(
      new Map([[testCase.id, { ...learnedProgress, learned: false }]]),
    )

    render(<DrillView />)
    expect(await screen.findByText('Nothing to drill yet')).toBeInTheDocument()
  })
})
