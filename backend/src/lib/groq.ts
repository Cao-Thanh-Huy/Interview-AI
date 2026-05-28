import Groq from 'groq-sdk'

let _client: Groq | null = null

/** Always get a client using the CURRENT process.env.GROQ_API_KEY */
export function getGroqClient(): Groq {
  const apiKey = (process.env.GROQ_API_KEY ?? '').replace(/^["']|["']$/g, '').trim()
  if (!apiKey) {
    console.warn('⚠️  GROQ_API_KEY is not set')
  }
  // Re-create if key changed (handles runtime settings update)
  if (!_client || (_client as any).apiKey !== apiKey) {
    _client = new Groq({ apiKey })
    ;(_client as any).apiKey = apiKey  // tag for equality check
  }
  return _client
}

// Default export kept for backward compat — resolves dynamically
const groqProxy = new Proxy({} as Groq, {
  get(_target, prop) {
    return (getGroqClient() as any)[prop]
  },
})

export default groqProxy

export const GROQ_MODEL = 'llama-3.1-8b-instant'
