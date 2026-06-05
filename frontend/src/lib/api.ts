import type {
  CompletionMode,
  HistoryTurn,
  SessionMetadata,
  SessionDetail,
} from './types'

// In dev mode (Vite), VITE_API_BASE is empty → relative path uses Vite proxy
// In Electron (file:// protocol), VITE_API_BASE = 'http://localhost:3001' → absolute URL
const BASE = (import.meta.env.VITE_API_BASE ?? '') + '/api'

/** Helper for components that call fetch() directly */
export const apiUrl = (path: string) => `${BASE}${path}`

export async function fetchDeepgramKey(): Promise<{ key: string }> {
  const res = await fetch(`${BASE}/deepgram`)
  if (!res.ok) throw new Error('Failed to fetch Deepgram key')
  return res.json()
}

export async function streamCompletion(
  transcript: string,
  context: string,
  mode: CompletionMode,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  sessionId?: string,
  history?: HistoryTurn[],
): Promise<void> {
  const res = await fetch(`${BASE}/completion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, context, mode, sessionId, history }),
    signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
}

/**
 * Gửi CV text lên backend → AI summary (qwen3-32b) → trả markdown
 */
export async function processCV(text: string, existingContext?: string): Promise<{ summary: string }> {
  const res = await fetch(`${BASE}/cv/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, existingContext }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export async function listHistory(): Promise<{ sessions: SessionMetadata[] }> {
  const res = await fetch(`${BASE}/history`)
  if (!res.ok) throw new Error('Failed to list history')
  return res.json()
}

export async function getHistorySession(sessionId: string): Promise<SessionDetail> {
  const res = await fetch(`${BASE}/history/${encodeURIComponent(sessionId)}`)
  if (!res.ok) throw new Error('Failed to load session')
  return res.json()
}

/**
 * Gọi AI Interviewer: tạo câu hỏi + gợi ý trả lời
 */
export async function practiceTurn(
  prompt: string,
  action: 'start' | 'next',
  context?: string,
  sessionId?: string,
): Promise<{ question: string; suggestion: string; questionModel?: string; suggestionModel?: string }> {
  const res = await fetch(`${BASE}/practice/turn`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, action, context, sessionId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

let _lastTranslateModel = ''
export function getLastTranslateModel(): string { return _lastTranslateModel }

export async function translateText(text: string): Promise<string> {
  const res = await fetch(`${BASE}/completion/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('Translation failed')
  const data = await res.json()
  _lastTranslateModel = data.model || _lastTranslateModel
  return data.translation
}

/**
 * Calls Deepgram TTS via backend proxy.
 * Returns an object URL pointing to the audio blob (caller must revoke after use).
 */
export async function fetchTTSAudio(
  text: string,
  voice = 'aura-asteria-en',
): Promise<string> {
  const res = await fetch(`${BASE}/deepgram/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `TTS failed: ${res.status}`)
  }
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}
