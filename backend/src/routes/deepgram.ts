import { Hono } from 'hono'

export const deepgramRouter = new Hono()

deepgramRouter.get('/', async (c) => {
  const apiKey = (process.env.DEEPGRAM_API_KEY ?? '').replace(/^["']|["']$/g, '').trim()

  if (!apiKey) {
    return c.json({ error: 'DEEPGRAM_API_KEY is not configured' }, 400)
  }

  // Return raw key directly — no temp key creation needed.
  // createProjectKey was causing 30s+ hangs due to Deepgram API permission issues.
  // The raw API key works fine for WebSocket streaming (usage:write scope).
  console.log('[Deepgram] Serving API key, length:', apiKey.length)
  return c.json({ key: apiKey })
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
