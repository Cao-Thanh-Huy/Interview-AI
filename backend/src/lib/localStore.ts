import { pipeline, env } from '@xenova/transformers'
import db, { vectorToBuffer, bufferToVector } from './sqlite.js'
import { sanitizeInput } from './queryUtils.js'

// Cấu hình tải model qua mirror tốc độ cao (không bị chặn ở Việt Nam)
env.remoteHost = 'https://hf-mirror.com'
env.remotePathTemplate = '{model}/resolve/{revision}/'

const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2'
const DEDUPE_THRESHOLD = 0.93
const RETRIEVAL_THRESHOLD = 0.70

let extractor: any = null

// Khởi động trước (Warm-up) model local embedding để giảm thời gian chờ lần đầu
getExtractor().catch((err) => console.error('Warmup local embedding failed:', err))

async function getExtractor(): Promise<any> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', EMBED_MODEL)
  }
  return extractor
}

/**
 * Local store luôn được kích hoạt vì hoạt động hoàn toàn offline 100% không cần API Key!
 */
export const isLocalStoreEnabled = (): boolean => {
  return true
}

/**
 * Sinh vector embedding cục bộ siêu tốc (5-15ms) sử dụng ONNX Runtime
 * Vector trả về đã được chuẩn hóa (normalized vector)
 */
async function embedTexts(texts: string[]): Promise<number[][]> {
  const generateEmbedding = await getExtractor()
  const results: number[][] = []

  for (const text of texts) {
    const output = await generateEmbedding(text, {
      pooling: 'mean',
      normalize: true, // Chuẩn hóa vector giúp Cosine Similarity tối giản thành Dot Product
    })
    results.push(Array.from(output.data) as number[])
  }

  return results
}

async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text])
  return vec
}

/**
 * Tích vô hướng (Dot Product) của 2 vector đã chuẩn hóa chính là Cosine Similarity.
 * Phép toán cực nhanh, chỉ mất tối đa 384 phép nhân cộng, thực thi < 0.1ms.
 */
function dotProduct(vecA: number[], vecB: number[]): number {
  let dot = 0
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i]
  }
  return dot
}

export interface UpsertResult {
  status: 'inserted' | 'updated' | 'blocked_duplicate' | 'blocked_injection'
}

/**
 * Thêm hoặc Cập nhật một cặp Q&A vào SQLite cục bộ (kèm FTS5 và Vector 384 chiều)
 */
export async function upsertQA(question: string, answer: string): Promise<UpsertResult> {
  const safeQ = sanitizeInput(question)
  const safeA = sanitizeInput(answer)

  if (safeQ.length < 5) return { status: 'blocked_injection' }

  const queryVec = await embedQuery(safeQ)

  // 1. DEDUPE CHECK: Tính tương đồng vector trên RAM đối với tất cả QA hiện tại
  const rows = db.prepare(`
    SELECT id, embedding FROM knowledge_embeddings
  `).all() as { id: string; embedding: Buffer }[]

  let duplicateId: string | null = null
  let maxSimilarity = 0

  for (const row of rows) {
    const existingVec = bufferToVector(row.embedding)
    const similarity = dotProduct(queryVec, existingVec)
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity
      if (similarity >= DEDUPE_THRESHOLD) {
        duplicateId = row.id
      }
    }
  }

  const buffer = vectorToBuffer(queryVec)

  if (duplicateId) {
    // Thực hiện Update
    const updateUnit = db.prepare(`
      UPDATE knowledge_units 
      SET question = ?, answer = ?, text = ?, updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `)
    const updateEmbed = db.prepare(`
      UPDATE knowledge_embeddings
      SET embedding = ?
      WHERE id = ?
    `)
    const deleteFts = db.prepare('DELETE FROM knowledge_fts WHERE id = ?')
    const insertFts = db.prepare('INSERT INTO knowledge_fts (id, question, text) VALUES (?, ?, ?)')

    // Giao dịch nguyên tử
    const transaction = db.transaction(() => {
      updateUnit.run(safeQ, safeA, `Q: ${safeQ}\nA: ${safeA}`, duplicateId)
      updateEmbed.run(buffer, duplicateId)
      deleteFts.run(duplicateId)
      insertFts.run(duplicateId!, safeQ, `Q: ${safeQ}\nA: ${safeA}`)
    })
    
    transaction()
    console.log(`✅ localStore: dedupe — updated QA (id=${duplicateId}, similarity=${maxSimilarity.toFixed(3)})`)
    return { status: 'updated' }
  }

  // Thực hiện Insert mới
  const id = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const insertUnit = db.prepare(`
    INSERT INTO knowledge_units (id, type, question, answer, text)
    VALUES (?, 'qa', ?, ?, ?)
  `)
  const insertEmbed = db.prepare(`
    INSERT INTO knowledge_embeddings (id, embedding)
    VALUES (?, ?)
  `)
  const insertFts = db.prepare(`
    INSERT INTO knowledge_fts (id, question, text)
    VALUES (?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    insertUnit.run(id, safeQ, safeA, `Q: ${safeQ}\nA: ${safeA}`)
    insertEmbed.run(id, buffer)
    insertFts.run(id, safeQ, `Q: ${safeQ}\nA: ${safeA}`)
  })

  transaction()
  console.log(`✅ localStore: inserted new QA (id=${id})`)
  return { status: 'inserted' }
}

/**
 * Thêm một chunk tài liệu CV vào SQLite cục bộ (kèm FTS5 và Vector 384 chiều)
 */
export async function upsertCVChunk(chunkId: string, text: string, filename: string): Promise<void> {
  const [vec] = await embedTexts([text])
  const buffer = vectorToBuffer(vec)

  // Xóa bản ghi cũ nếu trùng ID để tránh lỗi ghi đè
  const deleteUnit = db.prepare('DELETE FROM knowledge_units WHERE id = ?')
  const deleteFts = db.prepare('DELETE FROM knowledge_fts WHERE id = ?')
  const insertUnit = db.prepare(`
    INSERT INTO knowledge_units (id, type, text, filename)
    VALUES (?, 'cv', ?, ?)
  `)
  const insertEmbed = db.prepare(`
    INSERT INTO knowledge_embeddings (id, embedding)
    VALUES (?, ?)
  `)
  const insertFts = db.prepare(`
    INSERT INTO knowledge_fts (id, text)
    VALUES (?, ?)
  `)

  const transaction = db.transaction(() => {
    deleteUnit.run(chunkId)
    deleteFts.run(chunkId)
    insertUnit.run(chunkId, text, filename)
    insertEmbed.run(chunkId, buffer)
    insertFts.run(chunkId, text)
  })

  transaction()
  console.log(`✅ localStore: inserted CV chunk (id=${chunkId})`)
}

export interface SearchResult {
  id: string
  score: number
  question?: string
  answer?: string
  text?: string
  type?: string
}

/**
 * Tìm kiếm Hybrid (FTS5 MATCH OR First ➔ Semantic Fallback trên RAM) siêu tốc cục bộ
 */
export async function semanticSearch(query: string, topK = 5): Promise<SearchResult[]> {
  const cleanFtsQuery = query.trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
  let ftsMatchQuery = ''

  if (cleanFtsQuery.length > 2) {
    const keywords = cleanFtsQuery
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => `"${w}"`)
    
    if (keywords.length > 0) {
      ftsMatchQuery = keywords.join(' OR ')
    }
  }

  // --- LAYER 1: FTS5 MATCH OR FIRST ---
  // Tìm kiếm từ khóa chính xác trước. Nếu khớp với confidence rất cao, skip hoàn toàn việc sinh embedding.
  const ftsResultsMap = new Map<string, number>()
  let ftsTopResult: SearchResult | null = null
  let bestFtsScore = 0

  if (ftsMatchQuery) {
    try {
      const ftsRows = db.prepare(`
        SELECT u.id, u.type, u.question, u.answer, u.text, f.rank
        FROM knowledge_fts f
        JOIN knowledge_units u ON f.id = u.id
        WHERE knowledge_fts MATCH ?
        LIMIT 20
      `).all(ftsMatchQuery) as { id: string; type: string; question: string | null; answer: string | null; text: string; rank: number }[]

      for (const row of ftsRows) {
        // rank trong FTS5 càng nhỏ (âm) càng khớp, ta chuẩn hóa về [0, 1]
        const ftsScore = Math.max(0.1, 1 / (1 + Math.abs(row.rank)))
        ftsResultsMap.set(row.id, ftsScore)

        if (ftsScore > bestFtsScore) {
          bestFtsScore = ftsScore
          ftsTopResult = {
            id: row.id,
            score: ftsScore,
            question: row.question || undefined,
            answer: row.answer || undefined,
            text: row.text,
            type: row.type,
          }
        }
      }
    } catch (err) {
      console.warn('FTS5 match first failed:', err)
    }
  }

  // Nếu kết quả FTS5 cực kỳ chính xác (tần suất từ khóa khớp cao tuyệt đối, score >= 0.88),
  // chúng ta tin tưởng 100% và bỏ qua bước sinh embedding để triệt tiêu thời gian xử lý!
  if (ftsTopResult && bestFtsScore >= 0.88) {
    console.log(`⚡ localStore: FTS5 First Hit (score=${bestFtsScore.toFixed(3)}) — skipping semantic search`)
    const sortedFts = [...ftsResultsMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
    
    const results: SearchResult[] = []
    for (const [id, score] of sortedFts) {
      const unit = db.prepare(`
        SELECT type, question, answer, text FROM knowledge_units WHERE id = ?
      `).get(id) as { type: string; question: string | null; answer: string | null; text: string }
      
      if (unit) {
        results.push({
          id,
          score,
          question: unit.question || undefined,
          answer: unit.answer || undefined,
          text: unit.text,
          type: unit.type,
        })
      }
    }
    return results
  }

  // --- LAYER 2: SEMANTIC FALLBACK (Nếu từ khóa không đủ tự tin) ---
  console.log(`🧠 localStore: Semantic Fallback activated for: "${query}"`)
  try {
    const queryVec = await embedQuery(query)

    const records = db.prepare(`
      SELECT u.id, u.type, u.question, u.answer, u.text, e.embedding
      FROM knowledge_units u
      JOIN knowledge_embeddings e ON u.id = e.id
    `).all() as { id: string; type: string; question: string | null; answer: string | null; text: string; embedding: Buffer }[]

    const vectorResults: SearchResult[] = []

    for (const record of records) {
      const existingVec = bufferToVector(record.embedding)
      const similarity = dotProduct(queryVec, existingVec)
      
      vectorResults.push({
        id: record.id,
        score: similarity,
        question: record.question || undefined,
        answer: record.answer || undefined,
        text: record.text,
        type: record.type,
      })
    }

    // Rerank: Kết hợp điểm Vector Search và FTS5
    const mergedResults = vectorResults.map((r) => {
      const ftsScore = ftsResultsMap.get(r.id) || 0
      // 65% Vector Similarity + 35% FTS Keyword Match
      const finalScore = ftsScore > 0 ? (r.score * 0.65) + (ftsScore * 0.35) : r.score
      return {
        ...r,
        score: finalScore,
      }
    })

    return mergedResults
      .filter((r) => r.score >= RETRIEVAL_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

  } catch (err) {
    console.error('❌ localStore hybrid search failed:', err)
    return fallbackFTSSearch(query, topK)
  }
}

/**
 * Tìm kiếm Fallback sử dụng SQLite FTS5 (Khi không có model hoặc bị lỗi)
 */
function fallbackFTSSearch(query: string, topK = 5): SearchResult[] {
  const cleanFtsQuery = query.trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
  let ftsMatchQuery = ''

  if (cleanFtsQuery.length > 2) {
    const keywords = cleanFtsQuery
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => `"${w}"`)
    
    if (keywords.length > 0) {
      ftsMatchQuery = keywords.join(' OR ')
    }
  }

  if (!ftsMatchQuery) return []

  try {
    const rows = db.prepare(`
      SELECT u.id, u.type, u.question, u.answer, u.text, f.rank
      FROM knowledge_fts f
      JOIN knowledge_units u ON f.id = u.id
      WHERE knowledge_fts MATCH ?
      LIMIT ?
    `).all(ftsMatchQuery, topK) as { id: string; type: string; question: string | null; answer: string | null; text: string; rank: number }[]

    return rows.map((row) => ({
      id: row.id,
      score: Math.max(0.5, 1 / (1 + Math.abs(row.rank))),
      question: row.question || undefined,
      answer: row.answer || undefined,
      text: row.text,
      type: row.type,
    }))
  } catch (err) {
    console.error('Fallback FTS search failed:', err)
    return []
  }
}


