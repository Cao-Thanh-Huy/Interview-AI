import { Hono } from 'hono'
import { streamText } from 'hono/streaming'
import groq, { GROQ_MODEL } from '../lib/groq.js'
import { pdfStore } from '../lib/pdfStore.js'
import { buildPrompt, buildRAGPrompt, buildSummarizerPrompt, buildTrainingSuggestionPrompt, type HistoryTurn } from '../lib/prompts.js'
import { semanticSearch, isPineconeEnabled } from '../lib/pinecone.js'
import { isFillerTranscript, buildRetrievalQuery } from '../lib/queryUtils.js'
import { appendTurn } from '../lib/historyStore.js'

export const completionRouter = new Hono()

const CONTEXT_WINDOW_TURNS = 8 // last N turns sent for context window management

completionRouter.post('/', async (c) => {
  const body = await c.req.json<{
    transcript: string
    context?: string
    sessionId?: string
    history?: HistoryTurn[]
    mode?: 'copilot' | 'summarizer' | 'training'
  }>()

  const { transcript, context = '', sessionId, history = [], mode = 'copilot' } = body

  if (!transcript?.trim()) {
    return c.json({ error: 'transcript is required' }, 400)
  }

  // Training mode: search Pinecone first — use stored knowledge if found, else generate fresh
  if (mode === 'training') {
    let ragContext = ''
    if (isPineconeEnabled()) {
      try {
        const results = await semanticSearch(transcript, 3)
        if (results.length > 0) {
          ragContext = results
            .map((r) => r.question
              ? `Q: ${r.question}\nA: ${r.answer ?? r.text ?? ''}`
              : (r.text ?? ''))
            .filter(Boolean)
            .join('\n\n')
        }
      } catch (err) {
        console.warn('Pinecone search error (training):', err)
      }
    }
    const prompt = buildTrainingSuggestionPrompt(context, transcript, ragContext)
    let groqStream
    try {
      groqStream = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: GROQ_MODEL,
        temperature: 0.7,
        max_tokens: 400,
        stream: true,
      })
    } catch (err) {
      console.error('Groq API error (training):', err)
      return c.json({ error: 'AI service temporarily unavailable. Please try again.' }, 503)
    }
    return streamText(c, async (stream) => {
      for await (const chunk of groqStream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) await stream.write(content)
      }
    })
  }

  if (mode === 'summarizer') {
    const prompt = buildSummarizerPrompt(transcript)
    let groqStream
    try {
      groqStream = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: GROQ_MODEL,
        temperature: 0.7,
        max_tokens: 2000,
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
  }

  // --- Live Interview (copilot) mode ---
  const recentHistory = history.slice(-CONTEXT_WINDOW_TURNS)
  let prompt: string

  // Check for filler transcript — skip RAG, use minimal prompt
  const isFiller = isFillerTranscript(transcript)

  if (!isFiller && isPineconeEnabled()) {
    // Pinecone semantic RAG path
    const retrievalQuery = buildRetrievalQuery(transcript)
    let ragResults: import('../lib/pinecone.js').SearchResult[] = []
    try {
      ragResults = await semanticSearch(retrievalQuery, 5)
    } catch (err) {
      console.error('Pinecone search error:', err)
      // fallback to pdfStore below
    }

    if (ragResults.length > 0) {
      const ragContext = ragResults
        .map((r) => {
          if (r.type === 'cv' && r.text) return `CV: ${r.text}`
          if (r.question && r.answer) return `Q: ${r.question}\nA: ${r.answer}`
          return r.text ?? ''
        })
        .filter(Boolean)
        .join('\n\n')
      prompt = buildRAGPrompt(context, transcript, ragContext, recentHistory)
    } else {
      // Nothing above threshold — skip RAG to avoid hallucination
      prompt = buildPrompt(context, transcript, recentHistory)
    }
  } else {
    // Pinecone not available — fall back to local pdfStore
    const chunks = pdfStore.search(transcript, 5)
    prompt = chunks.length > 0
      ? buildRAGPrompt(context, transcript, chunks.join('\n\n'), recentHistory)
      : buildPrompt(context, transcript, recentHistory)
  }

  let groqStream
  try {
    groqStream = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL,
      temperature: 0.6,
      max_tokens: 300,
      stream: true,
    })
  } catch (err) {
    console.error('Groq API error:', err)
    return c.json({ error: 'AI service temporarily unavailable. Please try again.' }, 503)
  }

  // Buffer full answer so we can persist to history after streaming
  let fullAnswer = ''
  const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  return streamText(c, async (stream) => {
    for await (const chunk of groqStream) {
      const content = chunk.choices[0]?.delta?.content
      if (content) {
        fullAnswer += content
        await stream.write(content)
      }
    }

    // Persist turn to JSONL history (crash-safe append)
    if (sessionId) {
      try {
        appendTurn(sessionId, context, {
          id: turnId,
          question: transcript,
          answer: fullAnswer,
          timestamp: new Date().toISOString(),
        })
      } catch (err) {
        console.error('historyStore appendTurn failed:', err)
      }
    }
  })
})

