import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { BACKUP_FORMAT, backupFilename, buildBackup, parseBackup } from './backup'
import {
  addAttempt,
  allProgress,
  allAttempts,
  clearAll,
  putAll,
  resetDbForTests,
  setCustomAlg,
  toggleLearned,
} from './db'

const CASE_A = 'case-a'
const CASE_B = 'case-b'

beforeEach(async () => {
  await clearAll()
})

describe('parseBackup', () => {
  const valid = buildBackup(
    [{ caseId: CASE_A, learned: true, primaryAlgIndex: 1 }],
    [{ caseId: CASE_A, ms: 2000, at: 10, auf: 2 }],
  )

  it('accepts what buildBackup produces', () => {
    const result = parseBackup(JSON.stringify(valid))
    expect(result.ok).toBe(true)
  })

  it('refuses rather than half-applying, and says why', () => {
    const cases: Array<[string, string]> = [
      ['not json at all', 'not JSON'],
      [JSON.stringify({ hello: 'world' }), 'not a Lock In backup'],
      [JSON.stringify({ format: 'something-else', version: 1 }), 'not a Lock In backup'],
      [JSON.stringify({ ...valid, version: 99 }), 'newer version'],
      [JSON.stringify({ ...valid, progress: 'nope' }), 'missing'],
      [JSON.stringify({ ...valid, progress: [{ caseId: 1 }] }), 'corrupt'],
      [JSON.stringify({ ...valid, attempts: [{ caseId: 'a', ms: 1, at: 1, auf: 7 }] }), 'corrupt'],
      [JSON.stringify({ ...valid, attempts: [{ caseId: 'a', ms: -5, at: 1, auf: 0 }] }), 'corrupt'],
    ]
    for (const [text, expected] of cases) {
      const result = parseBackup(text)
      expect(result.ok, `should have refused: ${text.slice(0, 40)}`).toBe(false)
      if (!result.ok) expect(result.reason.toLowerCase()).toContain(expected.toLowerCase())
    }
  })

  it('keeps a custom algorithm and its AUF offset', () => {
    const withCustom = buildBackup(
      [
        {
          caseId: CASE_A,
          learned: true,
          primaryAlgIndex: 0,
          customAlg: { alg: "R U R'", aufOffset: 3 },
        },
      ],
      [],
    )
    const result = parseBackup(JSON.stringify(withCustom))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.progress[0].customAlg).toEqual({ alg: "R U R'", aufOffset: 3 })
    }
  })

  it('rejects a custom algorithm with no usable AUF offset', () => {
    const bad = { ...valid, progress: [{ caseId: 'a', learned: true, primaryAlgIndex: 0, customAlg: { alg: 'R' } }] }
    expect(parseBackup(JSON.stringify(bad)).ok).toBe(false)
  })
})

describe('the round trip', () => {
  // Issue 09's acceptance criterion, end to end: export, clear, import, and the
  // data must be identical. This is the check that the export is actually worth
  // having.
  it('survives export, clear and import', async () => {
    await toggleLearned(CASE_A)
    await setCustomAlg(CASE_A, { alg: "R U R'", aufOffset: 2 })
    await toggleLearned(CASE_B)
    await addAttempt({ caseId: CASE_A, ms: 2100, at: 100, auf: 1 })
    await addAttempt({ caseId: CASE_A, ms: 1900, at: 200, auf: 0 })
    await addAttempt({ caseId: CASE_B, ms: 3000, at: 300, auf: 3 })

    const before = buildBackup([...(await allProgress()).values()], await allAttempts())
    const serialised = JSON.stringify(before)

    await clearAll()
    resetDbForTests()
    expect((await allProgress()).size).toBe(0)
    expect(await allAttempts()).toHaveLength(0)

    const parsed = parseBackup(serialised)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    await putAll(parsed.data.progress, parsed.data.attempts)

    const after = buildBackup([...(await allProgress()).values()], await allAttempts())

    const sortP = (b: typeof before) => [...b.progress].sort((x, y) => x.caseId.localeCompare(y.caseId))
    const sortA = (b: typeof before) => [...b.attempts].sort((x, y) => x.at - y.at)
    expect(sortP(after)).toEqual(sortP(before))
    expect(sortA(after)).toEqual(sortA(before))
  })
})

describe('backupFilename', () => {
  it('is dated, so successive exports do not overwrite each other', () => {
    expect(backupFilename(new Date('2026-08-08T12:00:00Z'))).toBe('lock-in-2026-08-08.json')
  })

  it('names the format it is', () => {
    expect(BACKUP_FORMAT).toBe('lock-in-backup')
  })
})
