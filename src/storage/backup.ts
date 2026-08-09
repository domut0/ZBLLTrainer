import type { AttemptRecord, ProgressRecord } from './db'

/**
 * Export and import.
 *
 * This matters more than it sounds (PRD §8). There is no backend, so IndexedDB
 * is the only copy of the user's progress, and browser storage gets cleared —
 * by the browser, by a "clear site data", by reinstalling the PWA. The export
 * is the difference between a bad week and losing two years of work.
 *
 * The parser is deliberately strict and returns a reason rather than throwing.
 * Importing replaces everything, so accepting a malformed or foreign file and
 * half-applying it is the one outcome worse than refusing.
 */

export const BACKUP_FORMAT = 'lock-in-backup'
export const BACKUP_VERSION = 1

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  /** ISO 8601, for the filename and the "last exported" nag. */
  exportedAt: string
  progress: ProgressRecord[]
  attempts: AttemptRecord[]
}

export function buildBackup(
  progress: readonly ProgressRecord[],
  attempts: readonly AttemptRecord[],
  now: Date = new Date(),
): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    // Attempt ids are IndexedDB's, not ours; dropping them keeps an import
    // from colliding with rows that already exist.
    progress: progress.map((p) => ({ ...p })),
    attempts: attempts.map(({ id: _id, ...rest }) => ({ ...rest })),
  }
}

export const backupFilename = (now: Date = new Date()): string =>
  `lock-in-${now.toISOString().slice(0, 10)}.json`

export type ParsedBackup =
  | { ok: true; data: BackupFile }
  | { ok: false; reason: string }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function parseProgress(raw: unknown, index: number): ProgressRecord | string {
  if (!isObject(raw)) return `progress[${index}] is not an object`
  const { caseId, learned, primaryAlgIndex, customAlg } = raw
  if (typeof caseId !== 'string' || !caseId) return `progress[${index}] has no caseId`
  if (typeof learned !== 'boolean') return `progress[${index}].learned is not a boolean`
  if (typeof primaryAlgIndex !== 'number' || !Number.isInteger(primaryAlgIndex)) {
    return `progress[${index}].primaryAlgIndex is not an integer`
  }
  const record: ProgressRecord = { caseId, learned, primaryAlgIndex }
  if (customAlg !== undefined) {
    if (!isObject(customAlg) || typeof customAlg.alg !== 'string') {
      return `progress[${index}].customAlg is malformed`
    }
    const auf = customAlg.aufOffset
    if (auf !== 0 && auf !== 1 && auf !== 2 && auf !== 3) {
      return `progress[${index}].customAlg.aufOffset must be 0-3`
    }
    record.customAlg = { alg: customAlg.alg, aufOffset: auf }
  }
  return record
}

function parseAttempt(raw: unknown, index: number): AttemptRecord | string {
  if (!isObject(raw)) return `attempts[${index}] is not an object`
  const { caseId, ms, at, auf } = raw
  if (typeof caseId !== 'string' || !caseId) return `attempts[${index}] has no caseId`
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
    return `attempts[${index}].ms is not a duration`
  }
  if (typeof at !== 'number' || !Number.isFinite(at)) return `attempts[${index}].at is not a timestamp`
  if (auf !== 0 && auf !== 1 && auf !== 2 && auf !== 3) return `attempts[${index}].auf must be 0-3`
  return { caseId, ms, at, auf }
}

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'That file is not JSON.' }
  }
  if (!isObject(raw)) return { ok: false, reason: 'That file is not a Lock In backup.' }
  if (raw.format !== BACKUP_FORMAT) {
    return { ok: false, reason: 'That file is not a Lock In backup.' }
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return {
      ok: false,
      reason: `That backup was written by a newer version of Lock In (version ${String(raw.version)}).`,
    }
  }
  if (!Array.isArray(raw.progress) || !Array.isArray(raw.attempts)) {
    return { ok: false, reason: 'That backup is missing its progress or attempts.' }
  }

  const progress: ProgressRecord[] = []
  for (const [i, p] of raw.progress.entries()) {
    const parsed = parseProgress(p, i)
    if (typeof parsed === 'string') return { ok: false, reason: `Backup is corrupt: ${parsed}.` }
    progress.push(parsed)
  }

  const attempts: AttemptRecord[] = []
  for (const [i, a] of raw.attempts.entries()) {
    const parsed = parseAttempt(a, i)
    if (typeof parsed === 'string') return { ok: false, reason: `Backup is corrupt: ${parsed}.` }
    attempts.push(parsed)
  }

  return {
    ok: true,
    data: {
      format: BACKUP_FORMAT,
      version: raw.version,
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : new Date(0).toISOString(),
      progress,
      attempts,
    },
  }
}
