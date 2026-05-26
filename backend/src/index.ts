import './loadenv.js'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { completionRouter } from './routes/completion.js'
import { deepgramRouter } from './routes/deepgram.js'
import { knowledgeRouter } from './routes/knowledge.js'

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

app.route('/api/completion', completionRouter)
app.route('/api/deepgram', deepgramRouter)
app.route('/api/knowledge', knowledgeRouter)

// History routes are sub-routes of the knowledge router: /api/knowledge/history[/:sessionId]

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

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

serve({ fetch: app.fetch, port })


