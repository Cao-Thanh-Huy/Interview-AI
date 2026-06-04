import { Hono } from 'hono'
import { streamText } from 'hono/streaming'
import groq, { GROQ_MODEL } from '../lib/groq.js'
import { getClarificationResponse } from '../lib/queryUtils.js'
import { hotMemory } from '../lib/hotMemory.js'
import { appendTurn } from '../lib/historyStore.js'
import { correctASRTranscript, getASRCorrections } from '../lib/asrCorrection.js'

export const completionRouter = new Hono()

/** Build messages: system (rules + CV + session summary) → current question */
function buildMessages(
  combinedContext: string,
  sessionSummary: string,
  transcript: string,
): any[] {
  const sessionBlock = sessionSummary
    ? `[CONVERSATION SO FAR]\n${sessionSummary}`
    : ''

  const systemContent = `You are a job candidate. Basic English. Short sentences.

Rules:
- Answer from your background only. Do not invent technologies, projects, or experience.
- If information is missing, say "I don't have experience with that".
- Maintain conversational continuity. When the interviewer asks a follow-up question, continue discussing the subject of your immediately previous answer.

${combinedContext ? `[YOUR BACKGROUND]\n${combinedContext}` : ''}
${sessionBlock}`

  return [
    { role: 'system' as const, content: systemContent.trim() },
    { role: 'user' as const, content: transcript },
  ]
}

/** Merge new Q&A vào session summary (dùng 8b cho nhanh) */
async function updateSessionSummary(question: string, answer: string): Promise<string> {
  const oldSummary = hotMemory.getSessionSummary()
  const prompt = `Update this conversation summary with the new exchange.
Always indicate what the most recent question was about.

Current summary: ${oldSummary || '(empty)'}

New exchange:
Q: ${question}
A: ${answer}

Updated summary (keep concise):`

  try {
    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL, // 8b — nhanh, rẻ
      temperature: 0.3,
      max_tokens: 500,
    })
    const merged = response.choices[0]?.message?.content?.trim() || oldSummary

    // Auto-compress nếu quá dài (> 3000 ký tự)
    if (merged.length > 3000) {
      const compressPrompt = `Conversation summary:\n${merged}\n\nCondense slightly. Keep most details. Reduce redundancy. Keep recent context clear. Target around 2000-2500 characters.`
      const compressed = await groq.chat.completions.create({
        messages: [{ role: 'user', content: compressPrompt }],
        model: GROQ_MODEL,
        temperature: 0.3,
        max_tokens: 500,
      })
      const result = compressed.choices[0]?.message?.content?.trim() || merged
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

    // Update session summary (fire & forget — không block response)
    if (fullAnswer) {
      updateSessionSummary(transcript, fullAnswer).catch((err) =>
        console.error('Session summary error:', err)
      )
    }
  })
})
