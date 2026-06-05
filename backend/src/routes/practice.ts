import { Hono } from 'hono'
import { callWithFallback, MODELS_PRIORITY, MODELS_SUMMARY } from '../lib/groq.js'
import { hotMemory } from '../lib/hotMemory.js'
import { appendTurn } from '../lib/historyStore.js'
import { buildMessages } from './completion.js'

export const practiceRouter = new Hono()

/** Nén summary khi quá dài (chạy background, không blocking response) */
async function compressSummary(type: 'practice' | 'session'): Promise<void> {
  const text = type === 'practice' ? hotMemory.getPracticeSummary() : hotMemory.getSessionSummary()
  if (text.length <= 3000) return

  try {
    console.log(`[Practice] Compressing ${type} summary (${text.length} chars)`)
    const r = await callWithFallback(
      [{ role: 'user', content: `Condense this conversation summary. Keep most details. Keep recent context clear. Target 2000-2500 chars.\n\n${text}` }],
      MODELS_SUMMARY,
      { temperature: 0.3, max_tokens: 500 },
    )
    if (r.content) {
      if (type === 'practice') hotMemory.setPracticeSummary(r.content)
      else hotMemory.setSessionSummary(r.content)
    }
  } catch (err: any) {
    console.warn(`Compress ${type} failed:`, err?.message)
  }
}

// ─── POST /api/practice/turn ────────────────────────────────────────────────────
practiceRouter.post('/turn', async (c) => {
  let body
  try { body = await c.req.json() }
  catch { return c.json({ error: 'Invalid JSON body' }, 400) }

  const { prompt = '', action = 'next', context = '', sessionId = '' } = body

  if (!prompt?.trim()) {
    return c.json({ error: 'prompt is required' }, 400)
  }

  if (action === 'start') {
    hotMemory.resetPracticeSummary()
  }

  const candidateSummary = hotMemory.getCandidateSummary() || context
  const practiceSummary = hotMemory.getPracticeSummary()

  // ── Step 1: Generate question ─────────────────────────────────────────────────
  const systemPrompt = `You are conducting a practice interview.

The candidate's background:
${candidateSummary || '(no CV uploaded — ask general interview questions)'}

Role/Tone: "${prompt}"
(Use this to adjust your tone/difficulty. Base ALL questions on the candidate background above.)

Practice conversation so far:
${practiceSummary || '(empty)'}

Rules:
- CRITICAL: Base EVERY question on the candidate's background above.
- Do NOT ask generic questions (e.g. "Tell me about yourself", "Where do you see yourself").
- Ask ONE short, focused question at a time.
- Ask in English ONLY.
- Follow up naturally on previous topics.
- Do NOT repeat questions already asked.`

  let question: string
  try {
    const qResult = await callWithFallback(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Output ONLY the interview question. No explanations, no preamble, no meta-commentary. Just the question.' },
      ],
      MODELS_PRIORITY,
      { temperature: 0.7, max_tokens: 300 },
    )
    question = qResult.content
    if (!question) throw new Error('Empty question response')
    var questionModel = qResult.model
  } catch (err: any) {
    console.error('Question error:', err?.message)
    return c.json({ error: `AI service unavailable: ${err?.message || 'unknown'}` }, 503)
  }

  // ── Step 2: Generate suggestion ───────────────────────────────────────────────
  const sessionSummary = hotMemory.getSessionSummary()
  let suggestion: string
  let suggestionModel = questionModel
  try {
    const suggestionMessages = buildMessages(candidateSummary, sessionSummary, question)
    const sResult = await callWithFallback(
      suggestionMessages,
      MODELS_PRIORITY,
      { temperature: 0.6, max_tokens: 500 },
    )
    suggestion = sResult.content
    suggestionModel = sResult.model
  } catch (err: any) {
    console.error('Suggestion error:', err?.message)
    suggestion = ''
  }

  // ── Step 3: Update summaries — ĐỒNG BỘ, không race condition ─────────────────
  if (question && suggestion) {
    const entry = `Q: ${question}\nA: ${suggestion}`

    const oldP = hotMemory.getPracticeSummary()
    hotMemory.setPracticeSummary(oldP ? `${oldP}\n\n${entry}` : entry)

    const oldS = hotMemory.getSessionSummary()
    hotMemory.setSessionSummary(oldS ? `${oldS}\n\n${entry}` : entry)

    compressSummary('practice')
    compressSummary('session')

    // Lưu vào history
    if (sessionId) {
      appendTurn(sessionId, context, {
        id: `p-turn-${Date.now()}`,
        question,
        answer: suggestion,
        timestamp: new Date().toISOString(),
      }, 'practice')
    }
  }

  return c.json({ question, suggestion, questionModel, suggestionModel })
})
