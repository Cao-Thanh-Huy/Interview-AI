import { Hono } from 'hono'
import { streamText } from 'hono/streaming'
import groq, { GROQ_MODEL } from '../lib/groq.js'
import type { HistoryTurn } from '../lib/prompts.js'
import { getClarificationResponse } from '../lib/queryUtils.js'
import { hotMemory } from '../lib/hotMemory.js'
import { appendTurn } from '../lib/historyStore.js'
import { correctASRTranscript, getASRCorrections } from '../lib/asrCorrection.js'

export const completionRouter = new Hono()

/** Build messages array: system (rules + CV) → history (user/assistant) → current question */
function buildMessages(
  combinedContext: string,
  transcript: string,
  history: HistoryTurn[],
): any[] {
  const systemContent = `You are a job candidate. Basic English. Short sentences.

Examples:
Q: Describe your CDP project
A: I design Lakehouse architecture. Use MinIO, Trino, FastAPI. Metadata-driven pipelines.

Q: What about cloud?
A: Cloud version of CDP. Use AWS S3, Glue Catalog, Lambda. Automated ETL pipeline.

Q: Can you give more details?
A: I use Docker, Kubernetes for orchestration. Self-service tools so users run pipeline by themselves.

Q: Tell me about yourself
A: I am data engineer. 5 years experience. Work with Spark, Snowflake, Python.

Q: Do you know Java?
A: That not in my experience. I use Python, SQL mostly.

Q: Do you have any other projects?
A: I only have CDP. That main project in my background.

${combinedContext ? `Background:\n${combinedContext}` : ''}`

  const historyMessages = history.flatMap((t) => [
    { role: 'user' as const, content: t.question },
    { role: 'assistant' as const, content: t.answer },
  ])

  return [
    { role: 'system' as const, content: systemContent.trim() },
    ...historyMessages,
    { role: 'user' as const, content: transcript },
  ]
}

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
    console.error('Translation error:', err)
    return c.json({ error: 'Translation failed' }, 500)
  }
})

const CONTEXT_WINDOW_TURNS = 5 // gửi 5 câu hỏi gần nhất

completionRouter.post('/', async (c) => {
  let body
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const rawTranscript = typeof body.transcript === 'string'
    ? body.transcript
    : String(body.transcript ?? '')
  const { context = '', sessionId, history = [], mode = 'copilot' } = body

  if (!rawTranscript.trim()) {
    return c.json({ error: 'transcript is required' }, 400)
  }

  // ASR correction
  const transcript = correctASRTranscript(rawTranscript)
  if (transcript !== rawTranscript) {
    const fixes = getASRCorrections(rawTranscript)
    console.log(`[ASR] Corrected: "${rawTranscript}" → "${transcript}"`)
    fixes.forEach(f => console.log(`  [ASR] "${f.from}" → "${f.to}"`))
  }

  // ---- Training mode: generate draft answer ----
  if (mode === 'training') {
    const candidateSummary = hotMemory.getCandidateSummary()
    const combinedContext = (candidateSummary && context.includes(candidateSummary.slice(0, 100)))
      ? candidateSummary
      : [context, candidateSummary].filter(Boolean).join('\n\n')

    const prompt = `You are a job candidate with basic English.

Rules:
1. Use "I". Talk about your experience from your background.
2. Short simple sentences. Basic words.
3. NO definitions, NO textbook language.
4. If background no info, say "I don't have that".

${combinedContext ? `Your background:\n${combinedContext}\n\n` : ''}Practice question: "${transcript}"

Draft answer:`
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
      console.error('Groq error (training):', err)
      return c.json({ error: 'AI service unavailable' }, 503)
    }
    return streamText(c, async (stream) => {
      for await (const chunk of groqStream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) await stream.write(content)
      }
    })
  }

  // ---- Mock Interview: Score the user's spoken answer ----
  if (mode === 'mock-scoring') {
    const { suggestion = '', userAnswer = '' } = body
    const questionText = rawTranscript
    const prompt = `You are evaluating a candidate's spoken answer in a mock interview.

Question asked: "${questionText}"

Ideal answer (key points to cover):
${suggestion}

Candidate's actual answer:
"${userAnswer}"

Score this answer. Output EXACTLY in this format (no extra text):
SCORE: X/10
✓ [one good thing they said, max 10 words]
✓ [another good point if applicable, or omit]
✗ [one key thing missing or weak, max 10 words]
✗ [another gap if applicable, or omit]

Be concise. If the answer is blank or very short, score 0-2 and note it.
Only output the score block above — no intro, no commentary.`

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
      console.error('Groq error (mock-scoring):', err)
      return c.json({ error: 'AI service unavailable' }, 503)
    }
    return streamText(c, async (stream) => {
      for await (const chunk of groqStream) {
        const content = chunk.choices[0]?.delta?.content
        if (content) await stream.write(content)
      }
    })
  }

  // ---- Live Interview (copilot) mode ----
  const recentHistory = history.slice(-CONTEXT_WINDOW_TURNS)

  // Transcript quá ngắn → clarification
  if (transcript.trim().length < 3) {
    const clarification = getClarificationResponse()
    return streamText(c, async (stream) => {
      await stream.write(clarification)
    })
  }

  // Cập nhật conversation state vào hotMemory
  if (recentHistory.length > 0) {
    const historyText = recentHistory.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join('\n')
    hotMemory.setActiveInterviewState(historyText)
  }

  // Build messages array: system(CV+rules) → history(user/assistant pairs) → current question
  const candidateSummary = hotMemory.getCandidateSummary()
  let combinedContext: string
  if (candidateSummary && context.includes(candidateSummary.slice(0, 100))) {
    combinedContext = candidateSummary
  } else {
    combinedContext = [context, candidateSummary].filter(Boolean).join('\n\n')
  }
  const messages = buildMessages(combinedContext, transcript, recentHistory)

  let groqStream
  try {
    groqStream = await groq.chat.completions.create({
      messages,
      model: GROQ_MODEL,
      temperature: 0.6,
      max_tokens: 300,
      stream: true,
    })
  } catch (err) {
    console.error('Groq error:', err)
    return c.json({ error: 'AI service unavailable' }, 503)
  }

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

    // Persist turn to JSONL history
    if (sessionId) {
      try {
        appendTurn(sessionId, context.substring(0, 200), {
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
