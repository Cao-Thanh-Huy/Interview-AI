import type { CompletionMode, HistoryTurn, SessionMetadata, SessionDetail, UpsertQAResult } from './types'

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

export async function upsertQA(question: string, answer: string): Promise<UpsertQAResult> {
  const res = await fetch(`${BASE}/knowledge/qa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, answer }),
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


