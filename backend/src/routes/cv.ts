import { Hono } from 'hono'
import groq, { GROQ_MODEL_SUMMARY } from '../lib/groq.js'
import { hotMemory } from '../lib/hotMemory.js'
import { hasInjectionAttempt, sanitizeInput } from '../lib/queryUtils.js'

export const cvRouter = new Hono()

/**
 * POST /api/cv/process
 * Nhận CV text từ user → gọi Groq Qwen3-32b → summary markdown → lưu hotMemory
 * Body: { text: string }
 * Returns: { summary: string }
 */
cvRouter.post('/process', async (c) => {
  const body = await c.req.json<{ text?: string; existingContext?: string }>()
  const rawText = body?.text?.trim()
  const existingContext = body?.existingContext?.trim() || ''

  if (!rawText) {
    return c.json({ error: 'CV text is required' }, 400)
  }

  if (hasInjectionAttempt(rawText)) {
    return c.json({ error: 'Input contains disallowed content' }, 400)
  }

  const cleanText = sanitizeInput(rawText)

  // Cắt bớt nếu CV quá dài
  const MAX_CHARS = 100000
  const truncated = cleanText.length > MAX_CHARS
    ? cleanText.slice(0, MAX_CHARS) + '\n\n[...truncated...]'
    : cleanText

  try {
    // Nếu có existing context → merge, nếu không → summary mới
    const isMerge = existingContext.length > 0
    const prompt = isMerge
      ? `I already have a summary of my background. Now I have new information to add.

EXISTING SUMMARY:
${existingContext}

NEW INFORMATION TO ADD:
${truncated}

Merge the new information into the existing summary. Keep the same sections and format.
Preserve ALL existing information. Do NOT shorten or remove anything.
Only ADD the new information. Keep it as long as the original or longer.
Use simple English.`
      : `Read this candidate's CV text below. Understand ALL the information.

Then produce a structured markdown summary with these sections:
- ## Summary (2-3 sentences about who they are)
- ## Skills (bullet list of all technical skills)
- ## Experience (company, role, key achievements)
- ## Projects (project name, tech used, what they did)
- ## Education

Keep it concise but don't miss anything important. Use simple English.

CV TEXT:
${truncated}`

    const response = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL_SUMMARY,
      temperature: 0.3,
      max_tokens: 4096,
    })

    const summary = response.choices[0]?.message?.content?.trim() || ''

    if (!summary) {
      return c.json({ error: 'AI failed to generate summary' }, 500)
    }

    // Lọc rác từ Qwen3 output: <think> blocks + ```markdown code fences
    let cleanSummary = summary
      .replace(/<think>[\s\S]*?<\/think>/g, '')
      .replace(/```markdown\n?|```/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    // Nếu summary quá dài (> 5000 ký tự), tự động nén xuống ~4500
    if (cleanSummary.length > 5000) {
      console.log(`[CV] Summary too long (${cleanSummary.length} chars), compressing...`)
      try {
        const compressRes = await groq.chat.completions.create({
          messages: [
            { role: 'user', content: `Condense this candidate summary to about 4500 characters (currently ${cleanSummary.length}). Keep ALL key information: skills, experience, projects, education, technologies. Remove redundancy, keep everything important.\n\n${cleanSummary}` },
          ],
          model: GROQ_MODEL_SUMMARY,
          temperature: 0.3,
          max_tokens: 3000,
        })
        const compressed = compressRes.choices[0]?.message?.content?.trim() || ''
        if (compressed.length > 1000) {
          cleanSummary = compressed
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .replace(/```markdown\n?|```/g, '')
            .trim()
          console.log(`[CV] Compressed to ${cleanSummary.length} chars`)
        }
      } catch (err) {
        console.warn('[CV] Compression failed, keeping original:', err)
      }
    }

    // Lưu vào hotMemory để dùng trong interview
    hotMemory.setCandidateSummary(cleanSummary)

    console.log(`✅ CV processed: ${cleanSummary.split('\n').length} lines, ${rawText.length} chars → summary`)

    return c.json({ summary: cleanSummary })
  } catch (err) {
    console.error('CV processing error:', err)
    return c.json({ error: 'Failed to process CV. Please try again.' }, 500)
  }
})
