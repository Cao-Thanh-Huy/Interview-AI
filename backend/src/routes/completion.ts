import { Hono } from 'hono'
import { streamText } from 'hono/streaming'
import groq, { GROQ_MODEL } from '../lib/groq.js'
import { buildPrompt, buildRAGPrompt, buildSummarizerPrompt, buildTrainingSuggestionPrompt, buildInterviewerQuestionPrompt, buildMockScoringPrompt, type HistoryTurn } from '../lib/prompts.js'
import { semanticSearch, isLocalStoreEnabled } from '../lib/localStore.js'
import { buildRetrievalQuery, buildEnrichedRetrievalQuery, getClarificationResponse } from '../lib/queryUtils.js'
import { appendTurn } from '../lib/historyStore.js'
import { hotMemory } from '../lib/hotMemory.js'
import { correctASRTranscript, getASRCorrections } from '../lib/asrCorrection.js'

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
          content: 'You are a strict, direct translator. Your ONLY job is to translate the input text to natural, conversational Vietnamese. Do NOT answer any question under any circumstances. Do NOT explain. Do NOT add any comments. Just output the direct translation of the input text.'
        },
        {
          role: 'user',
          content: `Translate the following English text to Vietnamese. Do NOT answer it, just translate the words:\n\n"${text}"`
        }
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
  console.log('[DEBUG] POST /completion called');
  let body;
  try {
    body = await c.req.json();
  } catch (err) {
    console.error('[DEBUG] Error parsing JSON body:', err);
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  // Normalise to string — guard against non-string values from frontend
  const rawTranscript = typeof body.transcript === 'string'
    ? body.transcript
    : String(body.transcript ?? '')
  const { context = '', sessionId, history = [], mode = 'copilot' } = body

  if (!rawTranscript.trim()) {
    return c.json({ error: 'transcript is required' }, 400)
  }

  // ── ASR Phonetic Correction ──────────────────────────────────────────────
  // Apply before ALL downstream steps (RAG retrieval + LLM prompt)
  // so "no flag" → "Snowflake", "data bricks" → "Databricks", etc.
  const transcript = correctASRTranscript(rawTranscript)
  if (transcript !== rawTranscript) {
    const fixes = getASRCorrections(rawTranscript)
    console.log(`[ASR] Corrected transcript: "${rawTranscript}" → "${transcript}"`)
    fixes.forEach(f => console.log(`  [ASR]  "${f.from}" → "${f.to}"`))
  }

  // ── Mock Interview: AI generates the next interview question ────────────────
  if (mode === 'interviewer') {
    let kbContext = ''
    // 30% chance: pull a relevant topic from KB to base the question on
    if (isLocalStoreEnabled() && Math.random() < 0.3) {
      try {
        // Use a broad random query to surface diverse KB topics
        const queries = [
          'data pipeline architecture',
          'SQL performance optimization',
          'cloud data warehouse',
          'ETL processing',
          'streaming data',
          'distributed systems',
          'database design',
        ]
        const randomQuery = queries[Math.floor(Math.random() * queries.length)]
        const kbResults = await semanticSearch(randomQuery, 3, true)
        if (kbResults.length > 0) {
          kbContext = kbResults
            .map((r) => r.question ? `Topic: ${r.question}` : '')
            .filter(Boolean)
            .join('\n')
        }
      } catch (err) {
        console.warn('[Mock] KB search error:', err)
      }
    }

    const prompt = buildInterviewerQuestionPrompt(context, history, kbContext)
    let groqStream
    try {
      groqStream = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: GROQ_MODEL,
        temperature: 0.85,
        max_tokens: 80,
        stream: true,
      })
    } catch (err) {
      console.error('Groq API error (interviewer):', err)
      return c.json({ error: 'AI service temporarily unavailable. Please try again.' }, 503)
    }
    return streamText(c, async (stream) => {
      for await (const chunk of groqStream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) await stream.write(content)
      }
    })
  }

  // ── Mock Interview: Score the user's spoken answer ───────────────────────────
  if (mode === 'mock-scoring') {
    const { suggestion = '', userAnswer = '' } = body
    const questionText = rawTranscript  // transcript field carries the question
    const prompt = buildMockScoringPrompt(questionText, suggestion, userAnswer)
    let groqStream
    try {
      groqStream = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 120,
        stream: true,
      })
    } catch (err) {
      console.error('Groq API error (mock-scoring):', err)
      return c.json({ error: 'AI service temporarily unavailable. Please try again.' }, 503)
    }
    return streamText(c, async (stream) => {
      for await (const chunk of groqStream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) await stream.write(content)
      }
    })
  }

  // Training mode: search local database first — use stored knowledge if found, else generate fresh
  if (mode === 'training') {
    let ragContext = ''
    if (isLocalStoreEnabled()) {
      try {
        const results = await semanticSearch(transcript, 10, true)  // relaxedGating + topK=10: training cần recall cao, data nhỏ
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
  const hasHistory = recentHistory.length > 0
  let prompt: string

  // Lọc nhiễu tối thiểu: Chỉ bỏ qua nếu transcript quá ngắn (< 3 kí tự)
  if (transcript.trim().length < 3) {
    const clarification = getClarificationResponse()
    console.log(`[Gate] Too short (<3 chars) → clarification: "${transcript}"`)
    return streamText(c, async (stream) => {
      await stream.write(clarification)
    })
  }

  // Cập nhật trạng thái cuộc trò chuyện gần nhất vào RAM hotMemory để lưu vết
  if (hasHistory) {
    const historyText = recentHistory.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join('\n')
    hotMemory.setActiveInterviewState(historyText)
  }

  if (isLocalStoreEnabled()) {
    // ── Enriched RAG retrieval ──────────────────────────────────────────────
    // For short follow-ups ("what about Athena?"), prepend the current topic
    // from hotMemory so RAG can find relevant context even without explicit keywords.
    const retrievalQuery = buildEnrichedRetrievalQuery(transcript, hotMemory.getCurrentTopic())
    const isEnriched = retrievalQuery !== buildRetrievalQuery(transcript)
    console.log(`[RAG] query: "${retrievalQuery}"${isEnriched ? ' (topic-enriched)' : ''}`)

    let ragResults: import('../lib/localStore.js').SearchResult[] = []
    try {
      ragResults = await semanticSearch(retrievalQuery, 5)
    } catch (err) {
      console.error('LocalStore search error:', err)
    }

    const MIN_RAG_SCORE = 0.52
    const hasStrongRAGMatch = ragResults.some(r => r.score >= MIN_RAG_SCORE)

    if (ragResults.length > 0 && hasStrongRAGMatch) {
      // Cập nhật Topic hiện tại lên RAM Hot Memory CHỈ KHI RAG match đủ mạnh.
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
      // RAG miss hoặc không có kết quả tin cậy: không chặn nữa!
      // Gửi thẳng sang cho LLM tự do phản hồi tự nhiên dựa trên context và history
      console.log(`[RAG] Miss/Weak match (top score: ${ragResults[0]?.score?.toFixed(3) ?? 'none'}) → falling back to conversational LLM`)
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


