import { Hono } from 'hono'
import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export const debugRouter = new Hono()

const LOG_PATH = join(process.cwd(), '..', 'renderer-debug.log')

// Clear on startup
try { writeFileSync(LOG_PATH, `=== Renderer Debug Log — ${new Date().toISOString()} ===\n`) } catch {}

debugRouter.post('/log', async (c) => {
  try {
    const { level, msg, src, line } = await c.req.json()
    const entry = `[${new Date().toISOString().slice(11, 23)}] [${(level ?? 'INFO').toUpperCase()}] ${msg}  (${src ?? ''}:${line ?? 0})\n`
    appendFileSync(LOG_PATH, entry)
  } catch {}
  return c.json({ ok: true })
})
