import { Hono } from 'hono'
import { upsertQA, isPineconeEnabled } from '../lib/pinecone.js'
import { hasInjectionAttempt } from '../lib/queryUtils.js'
import { listSessions, getSessionTurns, getSessionMeta } from '../lib/historyStore.js'

export const pineconeRouter = new Hono()

/**
 * POST /api/pinecone/qa
 * Upsert a QA pair into Pinecone (with dedupe + injection guard).
 * Body: { question: string; answer: string }
 */
pineconeRouter.post('/qa', async (c) => {
  const body = await c.req.json<{ question?: string; answer?: string }>()
  const { question, answer } = body

  if (!question?.trim() || !answer?.trim()) {
    return c.json({ error: 'question and answer are required' }, 400)
  }

  if (hasInjectionAttempt(question) || hasInjectionAttempt(answer)) {
    return c.json({ error: 'Input contains disallowed content', status: 'blocked_injection' }, 400)
  }

  if (!isPineconeEnabled()) {
    return c.json({ error: 'Pinecone is not configured (PINECONE_API_KEY missing)' }, 503)
  }

  try {
    const result = await upsertQA(question.trim(), answer.trim())
    return c.json(result)
  } catch (err) {
    console.error('Pinecone upsert error:', err)
    return c.json({ error: 'Failed to save to knowledge base' }, 500)
  }
})

/**
 * GET /api/history
 * Returns a list of all recorded interview sessions (newest first).
 */
pineconeRouter.get('/history', (c) => {
  try {
    const sessions = listSessions()
    return c.json({ sessions })
  } catch (err) {
    console.error('History list error:', err)
    return c.json({ error: 'Failed to list history' }, 500)
  }
})

/**
 * GET /api/history/:sessionId
 * Returns metadata + turns for a specific session.
 */
pineconeRouter.get('/history/:sessionId', (c) => {
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
