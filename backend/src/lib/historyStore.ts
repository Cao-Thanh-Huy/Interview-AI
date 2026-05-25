import fs from 'node:fs'
import path from 'node:path'

const HISTORY_BASE = path.resolve('data', 'history')

export interface SessionMetadata {
  sessionId: string
  startedAt: string
  context: string
}

export interface TurnEntry {
  id: string
  question: string
  answer: string
  timestamp: string
}

function sessionDir(sessionId: string): string {
  return path.join(HISTORY_BASE, sessionId)
}

/**
 * Creates a new session directory and writes metadata.json.
 * Safe to call multiple times — skips if already exists.
 */
export function ensureSession(sessionId: string, context: string): void {
  const dir = sessionDir(sessionId)
  if (fs.existsSync(path.join(dir, 'metadata.json'))) return
  fs.mkdirSync(dir, { recursive: true })
  const meta: SessionMetadata = {
    sessionId,
    startedAt: new Date().toISOString(),
    context,
  }
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(meta, null, 2), 'utf-8')
}

/**
 * Appends a single turn to turns.jsonl (append-only, crash-safe).
 */
export function appendTurn(sessionId: string, context: string, turn: TurnEntry): void {
  ensureSession(sessionId, context)
  const file = path.join(sessionDir(sessionId), 'turns.jsonl')
  fs.appendFileSync(file, JSON.stringify(turn) + '\n', 'utf-8')
}

/**
 * Returns all session metadata objects sorted newest-first.
 */
export function listSessions(): SessionMetadata[] {
  if (!fs.existsSync(HISTORY_BASE)) return []
  return fs
    .readdirSync(HISTORY_BASE)
    .filter((d) => {
      try {
        return fs.statSync(path.join(HISTORY_BASE, d)).isDirectory()
      } catch {
        return false
      }
    })
    .map((d) => {
      try {
        const raw = fs.readFileSync(path.join(HISTORY_BASE, d, 'metadata.json'), 'utf-8')
        return JSON.parse(raw) as SessionMetadata
      } catch {
        return null
      }
    })
    .filter((m): m is SessionMetadata => m !== null)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/**
 * Returns all turns for a session by reading the JSONL file.
 */
export function getSessionTurns(sessionId: string): TurnEntry[] {
  const file = path.join(sessionDir(sessionId), 'turns.jsonl')
  if (!fs.existsSync(file)) return []
  return fs
    .readFileSync(file, 'utf-8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as TurnEntry
      } catch {
        return null
      }
    })
    .filter((t): t is TurnEntry => t !== null)
}

/**
 * Returns the metadata for a single session.
 */
export function getSessionMeta(sessionId: string): SessionMetadata | null {
  const metaFile = path.join(sessionDir(sessionId), 'metadata.json')
  if (!fs.existsSync(metaFile)) return null
  try {
    return JSON.parse(fs.readFileSync(metaFile, 'utf-8')) as SessionMetadata
  } catch {
    return null
  }
}
