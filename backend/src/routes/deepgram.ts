import { Hono } from 'hono'
import { createClient } from '@deepgram/sdk'

export const deepgramRouter = new Hono()

deepgramRouter.get('/', async (c) => {
  const apiKey = (process.env.DEEPGRAM_API_KEY ?? '').replace(/^["']|["']$/g, '').trim()

  if (!apiKey) {
    return c.json({ error: 'DEEPGRAM_API_KEY is not configured' }, 400)
  }

  const dg = createClient(apiKey)

  try {
    const { result, error } = await dg.manage.getProjects()

    if (error || !result?.projects[0]) {
      return c.json({ key: apiKey })
    }

    const project = result.projects[0]

    const { result: keyResult, error: keyError } = await dg.manage.createProjectKey(
      project.project_id,
      {
        comment: 'interview-ai-temp',
        scopes: ['usage:write'],
        tags: ['interview-ai'],
        time_to_live_in_seconds: 60,
      },
    )

    if (keyError) return c.json({ key: apiKey })

    return c.json(keyResult)
  } catch {
    // Fallback: return the raw API key for direct browser use
    return c.json({ key: apiKey })
  }
})

// ── TTS Proxy — Deepgram Speak API ────────────────────────────────────────────
// Proxies text-to-speech requests so the API key never leaves the backend.
// Voice options: aura-asteria-en (female), aura-orion-en (male), aura-luna-en
deepgramRouter.post('/speak', async (c) => {
  const apiKey = (process.env.DEEPGRAM_API_KEY ?? '').replace(/^["']|["']$/g, '').trim()

  if (!apiKey) {
    return c.json({ error: 'DEEPGRAM_API_KEY is not configured' }, 400)
  }

  const { text, voice = 'aura-asteria-en' } = await c.req.json<{ text: string; voice?: string }>()

  if (!text?.trim()) {
    return c.json({ error: 'text is required' }, 400)
  }

  try {
    const ttsRes = await fetch(
      `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      },
    )

    if (!ttsRes.ok) {
      const errText = await ttsRes.text().catch(() => '')
      console.error('[TTS] Deepgram error:', ttsRes.status, errText)
      return c.json({ error: `Deepgram TTS failed: ${ttsRes.status}` }, 502)
    }

    // Stream audio bytes back to the browser
    const audioBuffer = await ttsRes.arrayBuffer()
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': ttsRes.headers.get('Content-Type') ?? 'audio/mpeg',
        'Content-Length': String(audioBuffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[TTS] Unexpected error:', err)
    return c.json({ error: 'TTS request failed' }, 500)
  }
})
