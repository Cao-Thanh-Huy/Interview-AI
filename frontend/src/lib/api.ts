import type {
  CompletionMode,
  HistoryTurn,
  SessionMetadata,
  SessionDetail,
  UpsertQAResult,
  SuggestAliasesResult,
} from './types'

const BASE = '/api'

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
 * Upsert Q&A vào knowledge base, kèm optional aliases.
 */
export async function upsertQA(
  question: string,
  answer: string,
  aliases?: string[],
): Promise<UpsertQAResult> {
  const res = await fetch(`${BASE}/knowledge/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer, aliases }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * Gọi training-grade alias suggestion pipeline.
 * Scan toàn bộ KB → Groq generate → collision filter → impact compute.
 * Trả về SuggestedAlias[] kèm retrieval impact info.
 */
export async function suggestAliases(
  question: string,
  context?: string,
): Promise<SuggestAliasesResult> {
  const res = await fetch(`${BASE}/knowledge/suggest-aliases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, context }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export async function listHistory(): Promise<{ sessions: SessionMetadata[] }> {
  const res = await fetch(`${BASE}/knowledge/history`)
  if (!res.ok) throw new Error('Failed to list history')
  return res.json()
}

export async function getHistorySession(sessionId: string): Promise<SessionDetail> {
  const res = await fetch(`${BASE}/knowledge/history/${encodeURIComponent(sessionId)}`)
  if (!res.ok) throw new Error('Failed to load session')
  return res.json()
}

export async function translateText(text: string): Promise<string> {
  const res = await fetch(`${BASE}/completion/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error('Translation failed')
  const data = await res.json()
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

/**
 * Stream a mock-scoring response.
 * transcript = the question text; suggestion + userAnswer are extra fields.
 */
export async function streamMockScoring(
  question: string,
  suggestion: string,
  userAnswer: string,
  context: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/completion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: question,
      context,
      mode: 'mock-scoring',
      suggestion,
      userAnswer,
    }),
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
