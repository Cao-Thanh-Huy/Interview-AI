import { Hono } from 'hono'
import { listSessions, getSessionTurns, getSessionMeta, deleteSession, clearAllSessions } from '../lib/historyStore.js'

export const historyRouter = new Hono()

/**
 * GET /api/history
 */
historyRouter.get('/', (c) => {
  try {
    const sessions = listSessions()
    return c.json({ sessions })
  } catch (err) {
    console.error('History list error:', err)
    return c.json({ error: 'Failed to list history' }, 500)
  }
})

/**
 * DELETE /api/history — clear ALL sessions
 */
historyRouter.delete('/', (c) => {
  try {
    clearAllSessions()
    return c.json({ success: true })
  } catch (err) {
    console.error('History clear error:', err)
    return c.json({ error: 'Failed to clear history' }, 500)
  }
})

/**
 * GET /api/history/:sessionId
 */
historyRouter.get('/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
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

/**
 * DELETE /api/history/:sessionId — delete 1 session
 */
historyRouter.delete('/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
  if (!/^[\w-]+$/.test(sessionId)) {
    return c.json({ error: 'Invalid sessionId' }, 400)
  }
  try {
    const ok = deleteSession(sessionId)
    if (!ok) return c.json({ error: 'Session not found' }, 404)
    return c.json({ success: true })
  } catch (err) {
    console.error('History delete error:', err)
    return c.json({ error: 'Failed to delete session' }, 500)
  }
})
