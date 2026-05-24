import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { completionRouter } from './routes/completion.js'
import { deepgramRouter } from './routes/deepgram.js'
import { pdfRouter } from './routes/pdf.js'

const app = new Hono()

app.use('*', logger())

app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

app.route('/api/completion', completionRouter)
app.route('/api/deepgram', deepgramRouter)
app.route('/api/pdf', pdfRouter)

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }))

const port = Number(process.env.PORT ?? 3001)
console.log(`🚀 Backend running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
