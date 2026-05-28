import './loadenv.js'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { completionRouter } from './routes/completion.js'
import { deepgramRouter } from './routes/deepgram.js'
import { knowledgeRouter } from './routes/knowledge.js'
import { licenseRouter } from './routes/license.js'
import { settingsRouter } from './routes/settings.js'
import { licenseGuard, getLicenseStatus } from './middleware/licenseGuard.js'
import { getHWID } from './lib/license.js'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const app = new Hono()

app.use('*', logger())

const corsOrigins = ['http://localhost:5173', 'http://localhost:4173']
if (process.env.SHARE_HOST) {
  // Support both http and https (https used when --share enables SSL)
  corsOrigins.push(`http://${process.env.SHARE_HOST}:5173`)
  corsOrigins.push(`https://${process.env.SHARE_HOST}:5173`)
}

app.use(
  '/api/*',
  cors({
    origin: corsOrigins,
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

// ── License guard: chặn /api/* nếu chưa kích hoạt (trừ /api/license/*) ──────
app.use('/api/*', licenseGuard)

app.route('/api/license', licenseRouter)     // luôn public — UI kích hoạt
app.route('/api/completion', completionRouter)
app.route('/api/deepgram', deepgramRouter)
app.route('/api/knowledge', knowledgeRouter)
app.route('/api/settings', settingsRouter)   // public — không cần license

// History routes are sub-routes of the knowledge router: /api/knowledge/history[/:sessionId]

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

// ── Hiển thị trạng thái license khi khởi động ────────────────────────────────
{
  const ls = getLicenseStatus()
  if (!ls.valid) {
    console.log('━'.repeat(60))
    console.log('⚠️   PHẦN MỀM CHƯA ĐƯỢC KÍCH HOẠT')
    console.log(`     Mã máy (HWID): ${getHWID()}`)
    console.log('     → Mở trình duyệt tại http://localhost:3001')
    console.log('     → Nhập License Key để kích hoạt phần mềm.')
    console.log('━'.repeat(60))
  } else {
    console.log(`✅ License hợp lệ — Hết hạn: ${ls.expiresAt?.toLocaleDateString('vi-VN')}`)
  }
}

// ── Serve React frontend (chỉ active khi đóng gói exe, không ảnh hưởng dev) ─────
// Production: cwd=Release_Package/, frontend is at cwd/app/frontend-dist/
// Dev:        cwd=backend/, frontend is at cwd/../frontend/dist (not served by backend)
const possibleFrontendPaths = [
  join(process.cwd(), 'app', 'frontend-dist'),   // production (Release_Package/app/frontend-dist)
  join(process.cwd(), 'frontend-dist'),           // legacy / alternate layout
]
const frontendDistPath = possibleFrontendPaths.find(p => existsSync(p))
if (frontendDistPath) {
  app.use('/*', serveStatic({ root: frontendDistPath }))
  console.log(`🌐 Frontend static files served from ${frontendDistPath}`)
}

import groq, { GROQ_MODEL } from './lib/groq.js'
import { semanticSearch } from './lib/localStore.js'

async function warmupSystem() {
  console.log('⚡ Warm-up: Starting system warming sequence...')
  
  // 1. Warm up SQLite & Local ONNX Embedding inference
  try {
    const start = Date.now()
    await semanticSearch('warmup query', 1)
    console.log(`⚡ Warm-up: SQLite page cache & local ONNX embedding model warmed in ${Date.now() - start}ms`)
  } catch (err) {
    console.warn('⚡ Warm-up: Local database warming failed:', err)
  }

  // 2. Warm up Groq connection pool (establish TCP/TLS handshake in background)
  const apiKey = process.env.GROQ_API_KEY
  if (apiKey) {
    try {
      const start = Date.now()
      // Send a minimal 1-token background completion request
      await groq.chat.completions.create({
        messages: [{ role: 'user', content: 'Ping' }],
        model: GROQ_MODEL,
        max_tokens: 1,
      })
      console.log(`⚡ Warm-up: Groq API connection pool pre-warmed in ${Date.now() - start}ms`)
    } catch (err) {
      console.warn('⚡ Warm-up: Groq pre-warming failed:', err)
    }
  } else {
    console.log('⚡ Warm-up: GROQ_API_KEY not found, skipping API handshake warm-up.')
  }
}

warmupSystem().catch((err) => console.error('System warmup error:', err))

const port = Number(process.env.PORT ?? 3001)
console.log(`🚀 Backend running on http://localhost:${port}`)

// ── EADDRINUSE retry wrapper ─────────────────────────────────────────────────
// tsx watch sometimes restarts before the OS releases the port from the old
// process. Retry up to 5 times with 1.5s delay instead of crashing hard.
function startServer(retries = 5): void {
  try {
    const server = serve({ fetch: app.fetch, port })

    // @hono/node-server returns the underlying http.Server — attach error handler
    const s = server as unknown as import('node:http').Server
    s.on?.('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        if (retries > 0) {
          console.warn(`⚠️  Port ${port} still in use, retrying in 1.5s... (${retries} retries left)`)
          s.close?.()
          setTimeout(() => startServer(retries - 1), 1500)
        } else {
          console.error(`❌ Port ${port} still in use after all retries. Kill the process manually and restart.`)
          process.exit(1)
        }
      } else {
        throw err
      }
    })
  } catch (err: any) {
    // Synchronous EADDRINUSE (some environments throw instead of emitting)
    if (err?.code === 'EADDRINUSE' && retries > 0) {
      console.warn(`⚠️  Port ${port} still in use, retrying in 1.5s... (${retries} retries left)`)
      setTimeout(() => startServer(retries - 1), 1500)
    } else {
      throw err
    }
  }
}

startServer()
