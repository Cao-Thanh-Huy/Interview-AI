import { Hono } from 'hono'
import { upsertQA, isLocalStoreEnabled } from '../lib/localStore.js'
import { hasInjectionAttempt } from '../lib/queryUtils.js'
import { listSessions, getSessionTurns, getSessionMeta } from '../lib/historyStore.js'

export const knowledgeRouter = new Hono()

/**
 * POST /api/knowledge/qa
 * Upsert một cặp Q&A vào SQLite cục bộ (kèm FTS5 + Vector + trùng lặp guard).
 * Body: { question: string; answer: string }
 */
knowledgeRouter.post('/qa', async (c) => {
  const body = await c.req.json<{ question?: string; answer?: string }>()
  const { question, answer } = body

  if (!question?.trim() || !answer?.trim()) {
    return c.json({ error: 'question and answer are required' }, 400)
  }

  if (hasInjectionAttempt(question) || hasInjectionAttempt(answer)) {
    return c.json({ error: 'Input contains disallowed content', status: 'blocked_injection' }, 400)
  }

  if (!isLocalStoreEnabled()) {
    return c.json({ error: 'Local store is missing API Key for vector embedding generation' }, 503)
  }

  try {
    const result = await upsertQA(question.trim(), answer.trim())
    return c.json(result)
  } catch (err) {
    console.error('Knowledge upsert error:', err)
    return c.json({ error: 'Failed to save to local knowledge base' }, 500)
  }
})

/**
 * GET /api/knowledge/history
 * Trả về danh sách toàn bộ các phiên phỏng vấn đã lưu (mới nhất xếp trước).
 */
knowledgeRouter.get('/history', (c) => {
  try {
    const sessions = listSessions()
    return c.json({ sessions })
  } catch (err) {
    console.error('History list error:', err)
    return c.json({ error: 'Failed to list history' }, 500)
  }
})

/**
 * GET /api/knowledge/history/:sessionId
 * Trả về metadata + danh sách câu hỏi/trả lời cho một phiên cụ thể.
 */
knowledgeRouter.get('/history/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
  // Validate sessionId to prevent path traversal
  if (!/^[\w-]+$/.test(sessionId)) {
    return c.json({ error: 'Invalid sessionId' }, 400)
  }
  try {
    const meta = getSessionMeta(sessionId)
    if (!meta) return c.json({ error: 'Session not found' }, 404)
    const turns = getSessionTurns(sessionId)
    return c.json({ meta, turns })
  } catch (err) {
    console.error('History get error:', err)
    return c.json({ error: 'Failed to load session' }, 500)
  }
})
