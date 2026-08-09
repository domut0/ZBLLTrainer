import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Auf } from '@/data/types'

/**
 * Local persistence. There is no backend and never will be (PRD §9), so this is
 * the only copy of the user's progress, and `data/export.ts` is the only backup.
 *
 * Everything is keyed by the canonical case id, which the importer derives from
 * the last-layer state rather than from the spreadsheet's row order. That is
 * what lets `cases.json` be regenerated — from a corrected sheet, or with more
 * algorithms — without orphaning a single tick.
 */

export interface ProgressRecord {
  caseId: string
  /** Ticked: in the drill pool. The most important flag in the app. */
  learned: boolean
  /** Index into the case's `algs`. Ignored when `customAlg` is set. */
  primaryAlgIndex: number
  /** An algorithm the sheet does not have, pasted by the user. */
  customAlg?: string
}

export interface AttemptRecord {
  /** Auto-assigned by IndexedDB. */
  id?: number
  caseId: string
  /** Milliseconds. Time only — no success/fail, no penalties (PRD §2). */
  ms: number
  /** Epoch milliseconds. */
  at: number
  /** The AUF the case was served at. */
  auf: Auf
}

interface LockInDB extends DBSchema {
  progress: { key: string; value: ProgressRecord }
  attempts: {
    key: number
    value: AttemptRecord
    indexes: { 'by-case': string; 'by-at': number }
  }
}

const DB_NAME = 'lock-in'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<LockInDB>> | null = null

export function db(): Promise<IDBPDatabase<LockInDB>> {
  dbPromise ??= openDB<LockInDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore('progress', { keyPath: 'caseId' })
      const attempts = database.createObjectStore('attempts', {
        keyPath: 'id',
        autoIncrement: true,
      })
      attempts.createIndex('by-case', 'caseId')
      attempts.createIndex('by-at', 'at')
    },
  })
  return dbPromise
}

/** Drops the cached handle. Tests use this; the app does not. */
export function resetDbForTests(): void {
  dbPromise = null
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export const DEFAULT_PROGRESS = (caseId: string): ProgressRecord => ({
  caseId,
  learned: false,
  primaryAlgIndex: 0,
})

export async function getProgress(caseId: string): Promise<ProgressRecord> {
  return (await (await db()).get('progress', caseId)) ?? DEFAULT_PROGRESS(caseId)
}

export async function allProgress(): Promise<Map<string, ProgressRecord>> {
  const rows = await (await db()).getAll('progress')
  return new Map(rows.map((r) => [r.caseId, r]))
}

/** Read-modify-write in one transaction, so concurrent ticks cannot clobber. */
async function updateProgress(
  caseId: string,
  change: (current: ProgressRecord) => ProgressRecord,
): Promise<ProgressRecord> {
  const tx = (await db()).transaction('progress', 'readwrite')
  const current = (await tx.store.get(caseId)) ?? DEFAULT_PROGRESS(caseId)
  const next = change(current)
  await tx.store.put(next)
  await tx.done
  return next
}

export const setLearned = (caseId: string, learned: boolean) =>
  updateProgress(caseId, (p) => ({ ...p, learned }))

export const toggleLearned = (caseId: string) =>
  updateProgress(caseId, (p) => ({ ...p, learned: !p.learned }))

export const setPrimaryAlgIndex = (caseId: string, primaryAlgIndex: number) =>
  updateProgress(caseId, (p) => ({ ...p, primaryAlgIndex }))

/** Passing undefined clears the custom algorithm and falls back to the sheet's. */
export const setCustomAlg = (caseId: string, customAlg: string | undefined) =>
  updateProgress(caseId, (p) => {
    const next = { ...p }
    if (customAlg && customAlg.trim()) next.customAlg = customAlg.trim()
    else delete next.customAlg
    return next
  })

// ---------------------------------------------------------------------------
// Attempts
// ---------------------------------------------------------------------------

export async function addAttempt(attempt: Omit<AttemptRecord, 'id'>): Promise<number> {
  return (await db()).add('attempts', attempt as AttemptRecord)
}

export async function attemptsForCase(caseId: string): Promise<AttemptRecord[]> {
  const rows = await (await db()).getAllFromIndex('attempts', 'by-case', caseId)
  return rows.sort((a, b) => a.at - b.at)
}

export async function allAttempts(): Promise<AttemptRecord[]> {
  const rows = await (await db()).getAll('attempts')
  return rows.sort((a, b) => a.at - b.at)
}

/** The most recent attempt, or undefined. Backs the discard action. */
export async function lastAttempt(): Promise<AttemptRecord | undefined> {
  const cursor = await (await db())
    .transaction('attempts')
    .store.index('by-at')
    .openCursor(null, 'prev')
  return cursor?.value
}

export async function deleteAttempt(id: number): Promise<void> {
  await (await db()).delete('attempts', id)
}

/**
 * Discards the most recent attempt — a dropped cube or a misscramble. Returns
 * what it removed, or undefined if there was nothing to remove.
 */
export async function discardLastAttempt(): Promise<AttemptRecord | undefined> {
  const last = await lastAttempt()
  if (last?.id === undefined) return undefined
  await deleteAttempt(last.id)
  return last
}

// ---------------------------------------------------------------------------
// Wholesale, for export/import (Issue 09)
// ---------------------------------------------------------------------------

export async function clearAll(): Promise<void> {
  const database = await db()
  const tx = database.transaction(['progress', 'attempts'], 'readwrite')
  await Promise.all([tx.objectStore('progress').clear(), tx.objectStore('attempts').clear()])
  await tx.done
}

export async function putAll(
  progress: ProgressRecord[],
  attempts: AttemptRecord[],
): Promise<void> {
  const database = await db()
  const tx = database.transaction(['progress', 'attempts'], 'readwrite')
  const progressStore = tx.objectStore('progress')
  const attemptStore = tx.objectStore('attempts')
  for (const p of progress) await progressStore.put(p)
  // Drop incoming ids so a merge cannot collide with existing rows.
  for (const a of attempts) await attemptStore.put({ ...a, id: undefined } as AttemptRecord)
  await tx.done
}
