import { Hono } from 'hono'
import { streamText } from 'hono/streaming'
import groq, { GROQ_MODEL } from '../lib/groq.js'
import { buildPrompt, buildRAGPrompt, buildSummarizerPrompt, buildTrainingSuggestionPrompt, type HistoryTurn } from '../lib/prompts.js'
import { semanticSearch, isLocalStoreEnabled } from '../lib/localStore.js'
import { isFillerTranscript, buildRetrievalQuery } from '../lib/queryUtils.js'
import { appendTurn } from '../lib/historyStore.js'
import { hotMemory } from '../lib/hotMemory.js'

export const completionRouter = new Hono()

completionRouter.post('/translate', async (c) => {
  const { text } = await c.req.json<{ text: string }>()
  if (!text?.trim()) {
    return c.json({ error: 'text is required' }, 400)
  }

  try {
    const response = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a professional, extremely fast translator. Translate the following English interview question or sentence to natural, conversational Vietnamese. Output ONLY the translated text, with no explanation, no quotes, and no intro/outro.'
        },
        { role: 'user', content: text }
      ],
      model: GROQ_MODEL,
      temperature: 0.3,
      max_tokens: 150,
    })
    const translatedText = response.choices[0]?.message?.content?.trim() || ''
    return c.json({ translation: translatedText })
  } catch (err) {
    console.error('Translation error in /translate route:', err)
    return c.json({ error: 'Translation failed' }, 500)
  }
})

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

  // Training mode: search local database first — use stored knowledge if found, else generate fresh
  if (mode === 'training') {
    let ragContext = ''
    if (isLocalStoreEnabled()) {
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
        console.warn('LocalStore search error (training):', err)
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

  // Cập nhật trạng thái cuộc trò chuyện gần nhất vào RAM hotMemory để lưu vết
  if (recentHistory.length > 0) {
    const historyText = recentHistory.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join('\n')
    hotMemory.setActiveInterviewState(historyText)
  }

  if (!isFiller && isLocalStoreEnabled()) {
    // Local hybrid RAG path
    const retrievalQuery = buildRetrievalQuery(transcript)
    let ragResults: import('../lib/localStore.js').SearchResult[] = []
    try {
      ragResults = await semanticSearch(retrievalQuery, 5)
    } catch (err) {
      console.error('LocalStore search error:', err)
    }

    if (ragResults.length > 0) {
      // Tự động nhận diện và cập nhật Topic hiện tại lên RAM Hot Memory để phục vụ Topic Continuity
      const topMatch = ragResults[0]
      if (topMatch.question) {
        hotMemory.setCurrentTopic(topMatch.question)
      }

      // Trích xuất các tri thức tìm được từ DB
      const dbRagText = ragResults
        .map((r) => {
          if (r.type === 'cv' && r.text) return `CV: ${r.text}`
          if (r.question && r.answer) return `Q: ${r.question}\nA: ${r.answer}`
          return r.text ?? ''
        })
        .filter(Boolean)
        .join('\n\n')
      
      // Kết hợp tri thức DB + Tóm tắt CV/JD từ RAM Hot Memory thành Prompt RAG siêu mạnh
      const ramContext = hotMemory.getCompactContextMarkdown()
      const combinedRagContext = [ramContext, dbRagText].filter(Boolean).join('\n\n')

      prompt = buildRAGPrompt(context, transcript, combinedRagContext, recentHistory)
    } else {
      // Nothing above threshold — dùng Prompt thường kết hợp RAM Hot Memory
      const ramContext = hotMemory.getCompactContextMarkdown()
      const combinedContext = [context, ramContext].filter(Boolean).join('\n\n')
      prompt = buildPrompt(combinedContext, transcript, recentHistory)
    }
  } else {
    // LocalStore bị disable hoặc bị lỗi, dùng Prompt thường kết hợp RAM Hot Memory
    const ramContext = hotMemory.getCompactContextMarkdown()
    const combinedContext = [context, ramContext].filter(Boolean).join('\n\n')
    prompt = buildPrompt(combinedContext, transcript, recentHistory)
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


