import { Hono } from 'hono'
import {
  upsertQA,
  isLocalStoreEnabled,
  checkAliasCollision,
  computeAliasImpact,
  scanAllVectors,
  embedQueryCached,
  COLLISION_THRESHOLD,
  type SuggestedAlias,
} from '../lib/localStore.js'
import { hasInjectionAttempt, sanitizeInput } from '../lib/queryUtils.js'
import { listSessions, getSessionTurns, getSessionMeta } from '../lib/historyStore.js'
import groq, { GROQ_MODEL } from '../lib/groq.js'

export const knowledgeRouter = new Hono()

/**
 * POST /api/knowledge/qa
 * Upsert Q&A + optional aliases vào SQLite (FTS5 + Vector + dedupe guard)
 * Body: { question: string; answer: string; aliases?: string[] }
 */
knowledgeRouter.post('/qa', async (c) => {
  const body = await c.req.json<{ question?: string; answer?: string; aliases?: string[] }>()
  const { question, answer, aliases = [] } = body

  if (!question?.trim() || !answer?.trim()) {
    return c.json({ error: 'question and answer are required' }, 400)
  }
  if (hasInjectionAttempt(question) || hasInjectionAttempt(answer)) {
    return c.json({ error: 'Input contains disallowed content', status: 'blocked_injection' }, 400)
  }
  if (!isLocalStoreEnabled()) {
    return c.json({ error: 'Local store unavailable' }, 503)
  }

  // Sanitize & validate aliases
  const cleanAliases = Array.isArray(aliases)
    ? aliases
        .map((a) => (typeof a === 'string' ? sanitizeInput(a) : ''))
        .filter((a) => a.length >= 3 && !hasInjectionAttempt(a))
        .slice(0, 8)
    : []

  try {
    const result = await upsertQA(question.trim(), answer.trim(), cleanAliases)
    return c.json(result)
  } catch (err) {
    console.error('Knowledge upsert error:', err)
    return c.json({ error: 'Failed to save to local knowledge base' }, 500)
  }
})

/**
 * POST /api/knowledge/suggest-aliases
 * Training-grade alias suggestion pipeline:
 *   1. Full KB context scan (precision > speed)
 *   2. Groq generates 5 DISTINCT aliases (diversity-aware prompt)
 *   3. Strict collision detection (threshold 0.88) — full scan per alias
 *   4. Retrieval impact computation (top 2 nearest per alias for UI warning)
 * Body: { question: string; context?: string }
 * Returns: { aliases: SuggestedAlias[] }
 */
knowledgeRouter.post('/suggest-aliases', async (c) => {
  const body = await c.req.json<{ question?: string; context?: string }>()
  const { question, context = '' } = body

  if (!question?.trim()) {
    return c.json({ error: 'question is required' }, 400)
  }
  if (hasInjectionAttempt(question)) {
    return c.json({ error: 'Input contains disallowed content' }, 400)
  }

  const cleanQ = sanitizeInput(question.trim())

  // ── Step 1: Full KB Context Scan ─────────────────────────────
  // Quét TOÀN BỘ vectors, group by unit → Groq biết KB đang cover topic nào + alias nào đã có
  type KBUnit = { question: string; phrases: string[]; topScore: number }
  const kbCoverage: KBUnit[] = []
  let allFlatPhrases: string[] = []  // dùng cho collision check sau

  try {
    const queryVec = await embedQueryCached(cleanQ)
    const allResults = await scanAllVectors(queryVec)

    // Group by unit_id — giữ best score per unit
    const unitMap = new Map<string, KBUnit>()
    for (const r of allResults) {
      if (!unitMap.has(r.unit_id)) {
        unitMap.set(r.unit_id, { question: r.question || r.phrase, phrases: [], topScore: r.score })
      }
      unitMap.get(r.unit_id)!.phrases.push(r.phrase)
    }

    // Lấy top 8 units có score > 0.40 (low bar — cần bức tranh đầy đủ KB)
    const sorted = [...unitMap.values()]
      .sort((a, b) => b.topScore - a.topScore)
      .filter((u) => u.topScore > 0.40)
      .slice(0, 8)

    kbCoverage.push(...sorted)
    allFlatPhrases = allResults
      .filter((r) => r.score > 0.50)
      .map((r) => r.phrase)
      .slice(0, 30)

    console.log(`📚 suggest-aliases KB scan: ${unitMap.size} units found, ${kbCoverage.length} relevant (score>0.40)`)
  } catch (err) {
    console.warn('KB context scan failed (non-fatal):', err)
  }

  // ── Step 2: Groq Alias Generation ────────────────────────────
  let rawAliases: string[] = []
  try {
    // Build rich KB context block — Groq biết bạn đã có gì, suggest alias fill gaps
    const kbBlock = kbCoverage.length > 0
      ? `\nYour knowledge base already covers these topics (with existing phrasings):\n${
          kbCoverage.map((u) => {
            const existingPhrases = u.phrases.slice(0, 4).map((p) => `  • "${p}"`).join('\n')
            return `- Topic: "${u.question}"\n${existingPhrases}`
          }).join('\n')
        }\n\nGenerate aliases that are DISTINCT from ALL phrases listed above.\n`
      : ''

    const prompt = `You are a training data curator for an AI interview assistant.

Given this interview question: "${cleanQ}"
${kbBlock}
Generate 5 SEMANTICALLY DISTINCT variations of this question covering these different styles:
1. Formal/professional phrasing
2. Casual/conversational phrasing
3. Recruiter-style phrasing (e.g. "walk me through...", "give me a sense of...")
4. Short/direct phrasing (2-5 words)
5. Behavioral/contextual phrasing

Requirements:
- Genuinely different sentence structures and wording
- Same underlying intent as the original question
- NOT near-duplicates of each other
- NOT similar to ANY existing phrases listed above
- Do NOT generate greetings or off-topic questions

Output ONLY a valid JSON array of exactly 5 strings. No explanation, no markdown, no code block.`

    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL,
      temperature: 0.7,
      max_tokens: 300,
    })

    const raw = response.choices[0]?.message?.content?.trim() ?? ''
    // Parse JSON — strip markdown code fences nếu có
    const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(jsonStr)

    if (Array.isArray(parsed)) {
      rawAliases = parsed
        .filter((x): x is string => typeof x === 'string' && x.trim().length >= 3)
        .map((x) => sanitizeInput(x.trim()))
        .filter((x) => !hasInjectionAttempt(x))
        .slice(0, 8)
    }
  } catch (err) {
    console.error('Groq alias generation failed:', err)
    return c.json({ error: 'Failed to generate alias suggestions' }, 500)
  }

  if (rawAliases.length === 0) {
    return c.json({ aliases: [] })
  }

  // ── Step 3: Strict Collision Detection (full scan per alias) ──
  // Training threshold = COLLISION_THRESHOLD (0.88) — strict
  const filteredAliases: string[] = []
  const rejectedLog: string[] = []

  for (const alias of rawAliases) {
    try {
      const result = await checkAliasCollision(alias, null)  // null = not saved yet
      if (result.safe) {
        filteredAliases.push(alias)
      } else {
        rejectedLog.push(
          `Alias "${alias}" rejected: collides with "${result.collidesWith?.phrase}" (score=${result.collidesWith?.score.toFixed(3)})`
        )
      }
    } catch (err) {
      // Nếu collision check lỗi → conservative: giữ alias
      filteredAliases.push(alias)
    }
  }

  if (rejectedLog.length > 0) {
    console.log('🚫 Collision rejections:', rejectedLog)
  }

  // ── Step 4: Retrieval Impact Computation ──────────────────────
  // Tính top 2 nearest per alias từ OTHER units → UI warning
  const suggestedAliases: SuggestedAlias[] = []

  for (const alias of filteredAliases) {
    try {
      const impact = await computeAliasImpact(alias, null)
      suggestedAliases.push({ phrase: alias, impact })
    } catch (err) {
      suggestedAliases.push({ phrase: alias, impact: [] })
    }
  }

  console.log(`✅ suggest-aliases: question="${cleanQ}" → ${rawAliases.length} generated, ${filteredAliases.length} passed collision, ${rejectedLog.length} rejected`)

  return c.json({ aliases: suggestedAliases })
})

/**
 * GET /api/knowledge/history
 */
knowledgeRouter.get('/history', (c) => {
  try {
    const sessions = listSessions()
    return c.json({ sessions })
  } catch (err) {
    console.error('History list error:', err)
    return c.json({ error: 'Failed to list history' }, 500)
  }
})

/**
 * GET /api/knowledge/history/:sessionId
 */
knowledgeRouter.get('/history/:sessionId', (c) => {
  const sessionId = c.req.param('sessionId')
  if (!/^[\w-]+$/.test(sessionId)) {
    return c.json({ error: 'Invalid sessionId' }, 400)
  }
  try {
    const meta = getSessionMeta(sessionId)
    if (!meta) return c.json({ error: 'Session not found' }, 404)
    const turns = getSessionTurns(sessionId)
    return c.json({ meta, turns })
  } catch (err) {
    console.error('History get error:', err)
    return c.json({ error: 'Failed to load session' }, 500)
  }
})
