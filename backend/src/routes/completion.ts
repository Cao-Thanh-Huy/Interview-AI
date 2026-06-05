import { Hono } from 'hono'
import { streamText } from 'hono/streaming'
import groq, { getGroqClient, GROQ_MODEL, MODELS_PRIORITY, MODELS_SUMMARY, MODELS_TRANSLATE, callWithFallback, stripReasoning } from '../lib/groq.js'
import { getClarificationResponse } from '../lib/queryUtils.js'
import { hotMemory } from '../lib/hotMemory.js'
import { appendTurn } from '../lib/historyStore.js'
import { correctASRTranscript, getASRCorrections } from '../lib/asrCorrection.js'

export const completionRouter = new Hono()

/** Build messages: system (rules + CV + session summary) → current question */
export function buildMessages(
  combinedContext: string,
  sessionSummary: string,
  transcript: string,
): any[] {
  const sessionBlock = sessionSummary
    ? `[CONVERSATION SO FAR]\n${sessionSummary}`
    : ''

  const systemContent = `You are a job candidate. Answer short, direct, no fluff.

Rules:
- No numbers. No bullets. No paragraphs.
- Each sentence on its own line.
- Each sentence max 12 words.
- Minimum 3 sentences, maximum 4 sentences.
- Answer exactly what is asked. Do not explain why you are answering.
- Use simple words. English is not your first language.
- If missing info, say "I don't have experience with that".

Example of GOOD answer:
We had data migration issues
Legacy ETL was hard to refactor
We used incremental loading

Example of BAD answer (too long, has fillers):
I mean, migrating from legacy platform is complex. There are several challenges...

[BACKGROUND]
${combinedContext || '(not provided)'}

[HISTORY]
${sessionSummary || '(empty)'}`

  return [
    { role: 'system' as const, content: systemContent.trim() },
    { role: 'user' as const, content: transcript },
  ]
}

/** Merge new Q&A vào session summary (dùng model chain rẻ) */
export async function updateSessionSummary(question: string, answer: string): Promise<string> {
  const oldSummary = hotMemory.getSessionSummary()
  const prompt = [{ role: 'user' as const, content: `Update this conversation summary with the new exchange.
Always indicate what the most recent question was about.

Current summary: ${oldSummary || '(empty)'}

New exchange:
Q: ${question}
A: ${answer}

Updated summary (keep concise):` }]

  try {
    const r = await callWithFallback(prompt, MODELS_SUMMARY, { temperature: 0.3, max_tokens: 500 })
    const merged = r.content || oldSummary

    if (merged.length > 3000) {
      const c = await callWithFallback(
        [{ role: 'user', content: `Condense slightly. Keep most details. Reduce redundancy. Keep recent context clear. Target around 2000-2500 characters.\n\n${merged}` }],
        MODELS_SUMMARY,
        { temperature: 0.3, max_tokens: 500 },
      )
      const result = c.content || merged
      hotMemory.setSessionSummary(result)
      return result
    }

    hotMemory.setSessionSummary(merged)
    return merged
  } catch (err) {
    console.warn('Session summary update failed:', err)
    return oldSummary
  }
}

/** Tạo Groq stream với fallback model chain. Trả về { stream, model } */
async function createStreamWithFallback(
  messages: any[],
  opts: { temperature?: number; max_tokens?: number } = {},
): Promise<{ stream: any; model: string }> {
  let lastErr: any
  for (const model of MODELS_PRIORITY) {
    try {
      const stream = await getGroqClient().chat.completions.create({
        messages, model, ...opts, stream: true,
      })
      return { stream, model }
    } catch (err: any) {
      lastErr = err
      console.warn(`[Live] ⚠️ ${model} failed: ${(err?.message || err?.status || '').slice(0, 80)} → fallback`)
      continue
    }
  }
  throw lastErr || new Error('All models exhausted')
}

completionRouter.post('/translate', async (c) => {
  const { text } = await c.req.json<{ text: string }>()
  if (!text?.trim()) {
    return c.json({ error: 'text is required' }, 400)
  }

  try {
    const r = await callWithFallback(
      [
        { role: 'system', content: 'You are a strict, direct translator. Translate to natural conversational Vietnamese. No explanations.' },
        { role: 'user', content: `Translate to Vietnamese:\n"${text}"` },
      ],
      MODELS_TRANSLATE,
      { temperature: 0.3, max_tokens: 200 },
    )
    return c.json({ translation: r.content, model: r.model })
  } catch (err: any) {
    console.error('Translation error:', err?.message || err)
    return c.json({ error: 'Translation failed' }, 500)
  }
})

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
  const { context = '', sessionId, mode = 'copilot' } = body

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

  // Transcript quá ngắn → clarification
  if (transcript.trim().length < 3) {
    const clarification = getClarificationResponse()
    return streamText(c, async (stream) => {
      await stream.write(clarification)
    })
  }

  // Build messages với CV context + session summary
  const candidateSummary = hotMemory.getCandidateSummary()
  const sessionSummary = hotMemory.getSessionSummary()
  let combinedContext: string
  if (candidateSummary && context.includes(candidateSummary.slice(0, 100))) {
    combinedContext = candidateSummary
  } else {
    combinedContext = [context, candidateSummary].filter(Boolean).join('\n\n')
  }
  const messages = buildMessages(combinedContext, sessionSummary, transcript)

  let groqStream, liveModel = '70B'
  try {
    const result = await createStreamWithFallback(messages, { temperature: 0.6, max_tokens: 500 })
    groqStream = result.stream
    liveModel = result.model
  } catch (err: any) {
    console.error('Groq error:', err?.message || err)
    return c.json({ error: 'AI service unavailable' }, 503)
  }

  let fullAnswer = ''
  const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

  return streamText(c, async (stream) => {
    let buf = ''
    for await (const chunk of groqStream) {
      const raw = chunk.choices[0]?.delta?.content || ''
      fullAnswer += raw
      buf += raw
      // Strip complete <think> blocks, keep partial at end in buffer
      let cleaned = buf.replace(/<think>[\s\S]*?<\/think>/g, '')
      const openIdx = cleaned.lastIndexOf('<think>')
      const closeIdx = cleaned.lastIndexOf('</think>')
      if (openIdx > closeIdx) {
        // Unclosed <think> ở cuối buffer → giữ lại
        buf = cleaned.slice(openIdx)
        cleaned = cleaned.slice(0, openIdx)
      } else {
        buf = ''
      }
      if (cleaned) await stream.write(cleaned)
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

    // Update session summary (fire & forget — không block response)
    if (fullAnswer) {
      updateSessionSummary(transcript, fullAnswer).catch((err) =>
        console.error('Session summary error:', err)
      )
    }
  })
})
