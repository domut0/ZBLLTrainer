// Exercises the real IndexedDB code path against fake-indexeddb.
//
// BrowseView.test.tsx mocks `@/storage/db` wholesale, which is right for
// testing the UI wiring but means it would pass just as happily if persistence
// were completely broken. This file is the other half: no mocks, real object
// stores, and an explicit "survives a reload" check — the acceptance criterion
// that a mocked test cannot make.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  addAttempt,
  allProgress,
  attemptsForCase,
  clearAll,
  discardLastAttempt,
  chosenAlg,
  getProgress,
  lastAttempt,
  resetDbForTests,
  setCustomAlg,
  setPrimaryAlgIndex,
  toggleLearned,
} from './db'

const CASE_A = '[[0,1,2,3,4,5,6,7],[0,1,1,1,0,0,0,0],[2,1,3,0,4,5,6,7,8,9,10,11],[0,0,0,0,0,0,0,0,0,0,0,0]]'
const CASE_B = 'some-other-case-id'

/** Drops the cached connection, the way a page reload would. */
const reload = () => resetDbForTests()

beforeEach(async () => {
  await clearAll()
})

describe('progress', () => {
  it('defaults to unticked and the first algorithm', async () => {
    const p = await getProgress(CASE_A)
    expect(p).toEqual({ caseId: CASE_A, learned: false, primaryAlgIndex: 0 })
  })

  it('survives a reload — the criterion the mocked UI test cannot check', async () => {
    await toggleLearned(CASE_A)
    reload()
    expect((await getProgress(CASE_A)).learned).toBe(true)
    expect((await allProgress()).get(CASE_A)?.learned).toBe(true)
  })

  it('toggles back off', async () => {
    await toggleLearned(CASE_A)
    await toggleLearned(CASE_A)
    expect((await getProgress(CASE_A)).learned).toBe(false)
  })

  it('keeps cases independent', async () => {
    await toggleLearned(CASE_A)
    expect((await getProgress(CASE_B)).learned).toBe(false)
    expect((await allProgress()).size).toBe(1)
  })

  it('does not lose the tick when another field is written', async () => {
    await toggleLearned(CASE_A)
    await setPrimaryAlgIndex(CASE_A, 2)
    const p = await getProgress(CASE_A)
    expect(p.learned).toBe(true)
    expect(p.primaryAlgIndex).toBe(2)
  })

  it('sets and clears a custom algorithm, keeping its AUF offset', async () => {
    await setCustomAlg(CASE_A, { alg: "  R U R'  ", aufOffset: 2 })
    expect((await getProgress(CASE_A)).customAlg).toEqual({ alg: "R U R'", aufOffset: 2 })
    await setCustomAlg(CASE_A, undefined)
    expect((await getProgress(CASE_A)).customAlg).toBeUndefined()
    await setCustomAlg(CASE_A, { alg: '   ', aufOffset: 0 })
    expect((await getProgress(CASE_A)).customAlg).toBeUndefined()
  })

  it('prefers a custom algorithm over the picked alternative', async () => {
    const algs = [
      { alg: "R U R'", aufOffset: 0 as const },
      { alg: "L U L'", aufOffset: 1 as const },
    ]
    expect(chosenAlg(algs, undefined)).toEqual(algs[0])
    await setPrimaryAlgIndex(CASE_A, 1)
    expect(chosenAlg(algs, await getProgress(CASE_A))).toEqual(algs[1])
    await setCustomAlg(CASE_A, { alg: "F U F'", aufOffset: 3 })
    expect(chosenAlg(algs, await getProgress(CASE_A))).toEqual({ alg: "F U F'", aufOffset: 3 })
  })

  it('falls back to the first algorithm if the stored index is out of range', () => {
    const algs = [{ alg: "R U R'", aufOffset: 0 as const }]
    expect(chosenAlg(algs, { caseId: CASE_A, learned: false, primaryAlgIndex: 9 })).toEqual(algs[0])
  })
})

describe('attempts', () => {
  it('records and reads back per case, oldest first', async () => {
    await addAttempt({ caseId: CASE_A, ms: 2100, at: 200, auf: 1 })
    await addAttempt({ caseId: CASE_A, ms: 1900, at: 100, auf: 0 })
    await addAttempt({ caseId: CASE_B, ms: 3000, at: 300, auf: 2 })

    const forA = await attemptsForCase(CASE_A)
    expect(forA.map((a) => a.at)).toEqual([100, 200])
    expect(await attemptsForCase(CASE_B)).toHaveLength(1)
  })

  it('survives a reload', async () => {
    await addAttempt({ caseId: CASE_A, ms: 2100, at: 200, auf: 1 })
    reload()
    expect(await attemptsForCase(CASE_A)).toHaveLength(1)
  })

  it('discards the most recent attempt, not the most recently written', async () => {
    await addAttempt({ caseId: CASE_A, ms: 1000, at: 500, auf: 0 })
    await addAttempt({ caseId: CASE_A, ms: 2000, at: 100, auf: 0 })

    const discarded = await discardLastAttempt()
    expect(discarded?.at).toBe(500)
    expect(await attemptsForCase(CASE_A)).toHaveLength(1)
    expect((await lastAttempt())?.at).toBe(100)
  })

  it('discarding an empty store is a no-op rather than a throw', async () => {
    expect(await discardLastAttempt()).toBeUndefined()
  })
})
