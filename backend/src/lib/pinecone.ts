import { Pinecone } from '@pinecone-database/pinecone'
import { sanitizeInput } from './queryUtils.js'

const INDEX_NAME = 'interview-ai'
const NAMESPACE = 'knowledge'
const EMBED_MODEL = 'multilingual-e5-large'
const DEDUPE_THRESHOLD = 0.93
const RETRIEVAL_THRESHOLD = 0.70

let pc: Pinecone | null = null

function getClient(): Pinecone {
  if (!pc) {
    const apiKey = (process.env.PINECONE_API_KEY ?? '').replace(/^["']|["']$/g, '').trim()
    if (!apiKey) throw new Error('PINECONE_API_KEY is not set')
    pc = new Pinecone({ apiKey })
  }
  return pc
}

export const isPineconeEnabled = (): boolean => {
  return !!(process.env.PINECONE_API_KEY ?? '').replace(/^["']|["']$/g, '').trim()
}

export async function initPineconeIndex(): Promise<void> {
  if (!isPineconeEnabled()) {
    console.warn('⚠️  PINECONE_API_KEY not set — Pinecone RAG disabled, falling back to local pdfStore')
    return
  }
  try {
    const client = getClient()
    const { indexes } = await client.listIndexes()
    const exists = indexes?.some((i) => i.name === INDEX_NAME)
    if (!exists) {
      console.log(`🌲 Pinecone: creating index "${INDEX_NAME}" (dim=1024, cosine)…`)
      await client.createIndex({
        name: INDEX_NAME,
        dimension: 1024,
        metric: 'cosine',
        spec: { serverless: { cloud: 'aws', region: 'us-east-1' } },
      })
      // Wait for index to be ready (poll up to 60s)
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const desc = await client.describeIndex(INDEX_NAME)
        if (desc.status?.ready) break
      }
    }
    console.log(`✅ Pinecone index "${INDEX_NAME}" ready`)
  } catch (err) {
    console.error('Pinecone init error:', err)
  }
}

async function embedTexts(texts: string[], inputType: 'passage' | 'query' = 'passage'): Promise<number[][]> {
  const client = getClient()
  const result = await client.inference.embed({
    model: EMBED_MODEL,
    inputs: texts,
    parameters: { inputType, truncate: 'END' },
  })
  return result.data.map((e) => {
    if (e.vectorType !== 'dense') throw new Error('Expected dense embedding')
    return e.values as number[]
  })
}

async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text], 'query')
  return vec
}

export interface UpsertResult {
  status: 'inserted' | 'updated' | 'blocked_duplicate' | 'blocked_injection'
}

export async function upsertQA(question: string, answer: string): Promise<UpsertResult> {
  const safeQ = sanitizeInput(question)
  const safeA = sanitizeInput(answer)

  // Check if input was heavily modified by injection guard
  if (safeQ.length < 5) return { status: 'blocked_injection' }

  const client = getClient()
  const index = client.index(INDEX_NAME).namespace(NAMESPACE)

  const queryVec = await embedQuery(safeQ)

  // Dedupe check
  const existing = await index.query({
    vector: queryVec,
    topK: 1,
    includeMetadata: true,
  })

  if (existing.matches?.[0]?.score != null && existing.matches[0].score >= DEDUPE_THRESHOLD) {
    // Update existing vector with new answer — reuse queryVec (already embedded above)
    const existingId = existing.matches[0].id
    await index.upsert({
      records: [
        {
          id: existingId,
          values: queryVec,
          metadata: { question: safeQ, answer: safeA, updatedAt: new Date().toISOString() },
        },
      ],
    })
    console.log(`🌲 Pinecone: dedupe — updated existing QA (id=${existingId}, score=${existing.matches[0].score.toFixed(3)})`)
    return { status: 'updated' }
  }

  // Insert new vector — reuse queryVec (already embedded above)
  const vec = queryVec
  const id = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await index.upsert({
    records: [
      {
        id,
        values: vec,
        metadata: { question: safeQ, answer: safeA, createdAt: new Date().toISOString() },
      },
    ],
  })
  console.log(`🌲 Pinecone: inserted new QA (id=${id})`)
  return { status: 'inserted' }
}

export async function upsertCVChunk(chunkId: string, text: string, filename: string): Promise<void> {
  const client = getClient()
  const index = client.index(INDEX_NAME).namespace(NAMESPACE)
  const [vec] = await embedTexts([text])
  await index.upsert({
    records: [
      {
        id: chunkId,
        values: vec,
        metadata: { type: 'cv', text, filename, createdAt: new Date().toISOString() },
      },
    ],
  })
}

export interface SearchResult {
  id: string
  score: number
  question?: string
  answer?: string
  text?: string
  type?: string
}

export async function semanticSearch(query: string, topK = 5): Promise<SearchResult[]> {
  const client = getClient()
  const index = client.index(INDEX_NAME).namespace(NAMESPACE)

  const queryVec = await embedQuery(query)
  const results = await index.query({
    vector: queryVec,
    topK,
    includeMetadata: true,
  })

  return (
    results.matches
      ?.filter((m) => m.score != null && m.score >= RETRIEVAL_THRESHOLD)
      .map((m) => ({
        id: m.id,
        score: m.score!,
        question: m.metadata?.question as string | undefined,
        answer: m.metadata?.answer as string | undefined,
        text: m.metadata?.text as string | undefined,
        type: m.metadata?.type as string | undefined,
      })) ?? []
  )
}
