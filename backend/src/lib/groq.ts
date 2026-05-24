import Groq from 'groq-sdk'

const apiKey = (process.env.GROQ_API_KEY ?? '').replace(/^["']|["']$/g, '').trim()

if (!apiKey) {
  console.warn('⚠️  GROQ_API_KEY is not set')
}

const groq = new Groq({ apiKey })

export default groq

export const GROQ_MODEL = 'llama-3.1-8b-instant'
