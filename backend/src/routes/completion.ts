import { Hono } from 'hono'
import { streamText } from 'hono/streaming'
import groq, { GROQ_MODEL } from '../lib/groq.js'
import { pdfStore } from '../lib/pdfStore.js'
import { buildPrompt, buildRAGPrompt, buildSummarizerPrompt } from '../lib/prompts.js'

export const completionRouter = new Hono()

completionRouter.post('/', async (c) => {
  const body = await c.req.json<{
    transcript: string
    context?: string
    mode?: 'copilot' | 'summarizer'
  }>()

  const { transcript, context = '', mode = 'copilot' } = body

  if (!transcript?.trim()) {
    return c.json({ error: 'transcript is required' }, 400)
  }

  let prompt: string
  if (mode === 'copilot') {
    const chunks = pdfStore.search(transcript, 5)
    prompt =
      chunks.length > 0
        ? buildRAGPrompt(context, transcript, chunks.join('\n\n'))
        : buildPrompt(context, transcript)
  } else {
    prompt = buildSummarizerPrompt(transcript)
  }

  let groqStream
  try {
    groqStream = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL,
      temperature: 0.7,
      max_tokens: mode === 'summarizer' ? 2000 : 700,
      stream: true,
    })
  } catch (err) {
    console.error('Groq API error:', err)
    return c.json({ error: 'AI service temporarily unavailable. Please try again.' }, 503)
  }

  return streamText(c, async (stream) => {
    for await (const chunk of groqStream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) await stream.write(content)
    }
  })
})
