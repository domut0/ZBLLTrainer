// The Issue 10 prefactor: ZBLL stopped being an assumption and became a value.
//
// These are the checks that would catch the prefactor having quietly changed
// something. Everything else in the suite asserts behaviour that existed
// before; this file asserts that it *still* does.
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ALG_SETS,
  ALG_SET_BY_ID,
  CASES,
  DEFAULT_ALG_SET,
  asAlgSetId,
  casesInAlgSet,
  casesInSubset,
  groupsInAlgSet,
  groupsInSubset,
} from './index'
import idsBefore from './__fixtures__/case-ids-before-issue-10.json'
import { allProgress, getProgress, resetDbForTests, setLearned } from '@/storage/db'

describe('the algorithm set registry', () => {
  it('ships ZBLL, COLL, LXS, and ZBLS', () => {
    expect(ALG_SETS.map((s) => s.id)).toEqual(['ZBLL', 'COLL', 'LXS', 'ZBLS'])
    expect(DEFAULT_ALG_SET).toBe('ZBLL')
  })

  it('names the seven ZBLL subsets in teaching order', () => {
    expect(ALG_SET_BY_ID.get('ZBLL')?.subsets).toEqual(['T', 'U', 'L', 'H', 'Pi', 'S', 'AS'])
  })

  // A set id read back from localStorage is untrusted: it may name a set that
  // has since been removed, or be junk entirely. Falling through to ZBLL beats
  // rendering an empty app.
  it('falls back to the default for an id that is not registered', () => {
    expect(asAlgSetId('ZBLL')).toBe('ZBLL')
    expect(asAlgSetId('COLL')).toBe('COLL')
    expect(asAlgSetId('LXS')).toBe('LXS')
    expect(asAlgSetId('ZBLS')).toBe('ZBLS')
    expect(asAlgSetId('UNKNOWN')).toBe('ZBLL')
    expect(asAlgSetId(null)).toBe('ZBLL')
    expect(asAlgSetId(42)).toBe('ZBLL')
  })
})

describe('the cases themselves', () => {
  it('all belong to ZBLL, COLL, LXS, or ZBLS, and every ZBLL case carries a known subset', () => {
    const subsets = ALG_SET_BY_ID.get('ZBLL')!.subsets
    for (const c of CASES) {
      if (c.algSet === 'ZBLL') {
        expect(subsets).toContain(c.subset)
      } else if (c.algSet === 'COLL' || c.algSet === 'LXS' || c.algSet === 'ZBLS') {
        expect(c.subset).toBe('')
      } else {
        expect(['ZBLL', 'COLL', 'LXS', 'ZBLS']).toContain(c.algSet)
      }
    }
  })

  it('numbers 472 ZBLL, 40 COLL, 116 LXS, and 302 ZBLS cases', () => {
    expect(CASES.length).toBe(930)
    expect(casesInAlgSet('ZBLL').length).toBe(472)
    expect(casesInAlgSet('COLL').length).toBe(40)
    expect(casesInAlgSet('LXS').length).toBe(116)
    expect(casesInAlgSet('ZBLS').length).toBe(302)
  })

  it('keeps the measured per-subset counts', () => {
    const counts = Object.fromEntries(
      ALG_SET_BY_ID.get('ZBLL')!.subsets.map((s) => [s, casesInSubset('ZBLL', s).length]),
    )
    expect(counts).toEqual({ T: 72, U: 72, L: 72, H: 40, Pi: 72, S: 72, AS: 72 })
  })

  /**
   * The criterion this whole prefactor turns on. Progress is keyed by case id,
   * so an id that shifts silently orphans a tick — and the user would see it as
   * their progress having been eaten, with nothing in the app to explain it.
   * The fixture was captured from `cases.json` before the importer changed.
   */
  it('has not moved a single case id', () => {
    const zbllIds = CASES.filter((c) => c.algSet === 'ZBLL').map((c) => c.id)
    expect(zbllIds.sort()).toEqual(idsBefore)
    expect(idsBefore.length).toBe(472)
  })

  it('lists groups in sheet order rather than sorted', () => {
    const zbllGroups = groupsInAlgSet('ZBLL')
    expect(zbllGroups.length).toBeGreaterThan(0)
    expect(zbllGroups).not.toEqual([...zbllGroups].sort())
    // Every group belongs to exactly one subset, so the per-subset lists
    // partition the set's list.
    const viaSubsets = ALG_SET_BY_ID.get('ZBLL')!.subsets.flatMap((s) =>
      groupsInSubset('ZBLL', s),
    )
    expect(viaSubsets.sort()).toEqual([...zbllGroups].sort())
  })
})

describe('progress written before the prefactor', () => {
  beforeEach(() => resetDbForTests())

  /**
   * Simulates an existing install: a tick stored against an id from the old
   * `cases.json`, read back through the new code with no migration step.
   */
  it('still resolves, and still points at a real case', async () => {
    const preMigrationId = idsBefore[100]
    await setLearned(preMigrationId, true)
    resetDbForTests()

    expect((await getProgress(preMigrationId)).learned).toBe(true)
    expect((await allProgress()).get(preMigrationId)?.learned).toBe(true)

    const c = CASES.find((x) => x.id === preMigrationId)
    expect(c).toBeDefined()
    expect(c!.algSet).toBe('ZBLL')
  })
})
