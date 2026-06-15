import fs from 'node:fs'
import path from 'node:path'

// History base: relative to process.cwd() (same convention as sqlite.ts)
//   Dev:        cwd = backend/ → backend/data/history/
//   Production: cwd = {install_dir} → {install_dir}/data/history/
const HISTORY_BASE = path.resolve(process.cwd(), 'data', 'history')

export interface SessionMetadata {
  sessionId: string
  startedAt: string
  context: string
  firstQuestion?: string  // first turn question — for UI preview
  type?: 'live' | 'practice'  // phân biệt loại session
}

export interface TurnEntry {
  id: string
  question: string
  answer: string
  timestamp: string
  turnId?: string       // overlay turn ID — dùng để dedup (replace nếu cùng turn)
}

function sessionDir(sessionId: string): string {
  return path.join(HISTORY_BASE, sessionId)
}

/**
 * Creates a new session directory and writes metadata.json.
 * Safe to call multiple times — skips if already exists.
 */
export function ensureSession(sessionId: string, context: string, type?: 'live' | 'practice'): void {
  const dir = sessionDir(sessionId)
  if (fs.existsSync(path.join(dir, 'metadata.json'))) return
  fs.mkdirSync(dir, { recursive: true })
  const meta: SessionMetadata = {
    sessionId,
    startedAt: new Date().toISOString(),
    context,
    type,
  }
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(meta, null, 2), 'utf-8')
}

export function appendTurn(sessionId: string, context: string, turn: TurnEntry, type?: 'live' | 'practice'): void {
  ensureSession(sessionId, context, type)
  const file = path.join(sessionDir(sessionId), 'turns.jsonl')

  // Dedup: nếu turn cuối có cùng turnId trong 60s → REPLACE (isFinal #1 → #2+ refinement)
  // Nếu không có turnId nhưng cùng question text → cũng replace (safety net)
  try {
    if (fs.existsSync(file)) {
      const lines = fs.readFileSync(file, 'utf-8').split('\n').filter(Boolean)
      if (lines.length > 0) {
        const lastTurn = JSON.parse(lines[lines.length - 1]) as TurnEntry
        const timeDiff = new Date(turn.timestamp).getTime() - new Date(lastTurn.timestamp).getTime()
        if (timeDiff < 60000) {
          const sameTurn = turn.turnId && lastTurn.turnId === turn.turnId
          const sameQuestion = !turn.turnId && lastTurn.question === turn.question
          if (sameTurn || sameQuestion) {
            lines[lines.length - 1] = JSON.stringify(turn)
            fs.writeFileSync(file, lines.join('\n') + '\n', 'utf-8')
            console.log(`[historyStore] Replaced turn: "${turn.question.slice(0, 40)}..."`)
            return
          }
        }
      }
    }
  } catch {
    // Non-fatal — nếu read file lỗi thì vẫn append bình thường
  }

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
    .map((m) => {
      // Peek first turn for UI preview
      try {
        const turnsFile = path.join(HISTORY_BASE, m.sessionId, 'turns.jsonl')
        if (fs.existsSync(turnsFile)) {
          const firstLine = fs.readFileSync(turnsFile, 'utf-8').split('\n').find(Boolean)
          if (firstLine) {
            const turn = JSON.parse(firstLine) as TurnEntry
            if (turn.question) m.firstQuestion = turn.question
          }
        }
      } catch { /* non-fatal */ }
      return m
    })
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

/**
 * Delete a single session directory (metadata + turns).
 */
export function deleteSession(sessionId: string): boolean {
  const dir = sessionDir(sessionId)
  if (!fs.existsSync(dir)) return false
  try {
    fs.rmSync(dir, { recursive: true, force: true })
    console.log(`[historyStore] Deleted session: ${sessionId}`)
    return true
  } catch (err) {
    console.error(`[historyStore] Failed to delete session ${sessionId}:`, err)
    return false
  }
}

/**
 * Delete ALL session directories.
 */
export function clearAllSessions(): boolean {
  if (!fs.existsSync(HISTORY_BASE)) return true
  try {
    const dirs = fs.readdirSync(HISTORY_BASE).filter((d) => {
      try { return fs.statSync(path.join(HISTORY_BASE, d)).isDirectory() } catch { return false }
    })
    for (const d of dirs) {
      fs.rmSync(path.join(HISTORY_BASE, d), { recursive: true, force: true })
    }
    console.log(`[historyStore] Cleared all sessions (${dirs.length} dirs)`)
    return true
  } catch (err) {
    console.error(`[historyStore] Failed to clear all sessions:`, err)
    return false
  }
}
