import Groq from 'groq-sdk'

let _client: Groq | null = null

export function getGroqClient(): Groq {
  const apiKey = (process.env.GROQ_API_KEY ?? '').replace(/^["']|["']$/g, '').trim()
  if (!apiKey) console.warn('⚠️  GROQ_API_KEY is not set')
  if (!_client || (_client as any).apiKey !== apiKey) {
    _client = new Groq({ apiKey })
    ;(_client as any).apiKey = apiKey
  }
  return _client
}

const groqProxy = new Proxy({} as Groq, {
  get(_target, prop) { return (getGroqClient() as any)[prop] },
})
export default groqProxy

export const GROQ_MODEL = 'llama-3.3-70b-versatile'
export const GROQ_MODEL_SUMMARY = 'qwen/qwen3-32b'

// ─── Model chains — user-verified fallback priorities ─────────────────────

/** REALTIME ANSWER (Question + Suggestion) */
export const MODELS_PRIORITY = [
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'allam-2-7b',
]

/** ENGLISH → VIETNAMESE TRANSLATION */
export const MODELS_TRANSLATE = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'allam-2-7b',
]

/** SUMMARIZATION */
export const MODELS_SUMMARY = [
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-20b',
  'llama-3.1-8b-instant',
  'allam-2-7b',
]

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Rút gọn model name để hiển thị: "70B", "120B", "Qwen32B"... */
export function shortModelName(model: string): string {
  const map: Record<string, string> = {
    'llama-3.3-70b-versatile': '70B',
    'openai/gpt-oss-120b': '120B',
    'openai/gpt-oss-20b': '20B',
    'llama-3.1-8b-instant': '8B',
    'groq/compound-mini': 'CmpdMini',
    'allam-2-7b': 'Allam7B',
    'openai/gpt-oss-safeguard-20b': 'Safe20B',
  }
  return map[model] || model.split('/').pop() || model
}

/** Strip reasoning tags khỏi content */
export function stripReasoning(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/g, '')             // Qwen think
    .replace(/<\|im_start\|>thought[\s\S]*?<\|im_end\|>/g, '') // Tokenized thought
    .replace(/```(?:reasoning|think)[\s\S]*?```/g, '')     // Code-fenced reasoning
    .replace(/^Reasoning:[\s\S]*?(?=\n|$)/gm, '')          // "Reasoning:" prefix
    .replace(/^思考[\s\S]*?(?=\n|$)/gm, '')                // Chinese reasoning
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ─── Model fallback chain ─────────────────────────────────────────────────

interface CallOpts { temperature?: number; max_tokens?: number }

/**
 * Gọi Groq với fallback chain. Trả về content + model name.
 * Strip reasoning tags tự động.
 */
export async function callWithFallback(
  messages: any[],
  models: string[] = MODELS_PRIORITY,
  opts: CallOpts = {},
): Promise<{ content: string; model: string }> {
  let lastErr: any

  for (const model of models) {
    try {
      const groqParams: any = {
        messages, model,
        temperature: opts.temperature ?? 0.6,
      }
      if (opts.max_tokens !== undefined) groqParams.max_tokens = opts.max_tokens
      const r = await getGroqClient().chat.completions.create(groqParams)
      let content = r.choices[0]?.message?.content?.trim() || ''
      content = stripReasoning(content)
      if (content) {
        console.log(`[Groq] ✅ ${model} (${content.length} chars)`)
        return { content, model }
      }
      lastErr = new Error('Empty response')
    } catch (err: any) {
      lastErr = err
      const msg = err?.message || ''
      console.warn(`[Groq] ⚠️ ${model} failed: ${(msg || err.status || '').slice(0, 80)} → fallback`)
      continue  // Thử model tiếp theo với MỌI lỗi
    }
  }
  throw lastErr || new Error('All Groq models exhausted')
}
