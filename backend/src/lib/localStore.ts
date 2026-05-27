import { pipeline, env } from '@xenova/transformers'
import db, { vectorToBuffer, bufferToVector } from './sqlite.js'
import { sanitizeInput } from './queryUtils.js'

// Mirror tốc độ cao (không bị chặn ở Việt Nam)
env.remoteHost = 'https://hf-mirror.com'
env.remotePathTemplate = '{model}/resolve/{revision}/'

const EMBED_MODEL = 'Xenova/all-MiniLM-L6-v2'

// --- Thresholds ---
// Runtime retrieval (live interview) — ưu tiên latency, fail soft
const RETRIEVAL_THRESHOLD_HIGH   = 0.82  // direct accept
const RETRIEVAL_THRESHOLD_MID    = 0.65  // accept nếu có FTS overlap
const RETRIEVAL_THRESHOLD_LOW    = 0.58  // accept nếu có keyword overlap trong phrase
// Training collision detection — ưu tiên precision, strict
export const COLLISION_THRESHOLD = 0.88

// Dedupe khi upsert
const DEDUPE_THRESHOLD = 0.93

// Alias hard max
const ALIAS_MAX = 8

let extractor: any = null

// Warm-up model
getExtractor().catch((err) => console.error('Warmup local embedding failed:', err))

async function getExtractor(): Promise<any> {
  if (!extractor) {
    extractor = await pipeline('feature-extraction', EMBED_MODEL)
  }
  return extractor
}

// ─────────────────────────────────────────────────────────
//  Query Embedding Cache — TTL 5 phút, max 200 entries
//  Giảm latency cho realtime voice pipeline (partial transcript spam)
// ─────────────────────────────────────────────────────────
const embeddingCache = new Map<string, { vec: number[]; ts: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_MAX = 200

function pruneCache() {
  if (embeddingCache.size <= CACHE_MAX) return
  const now = Date.now()
  // Xóa entries hết hạn trước
  for (const [key, val] of embeddingCache.entries()) {
    if (now - val.ts > CACHE_TTL_MS) embeddingCache.delete(key)
    if (embeddingCache.size <= CACHE_MAX) break
  }
  // Nếu vẫn quá, xóa entry cũ nhất
  if (embeddingCache.size > CACHE_MAX) {
    const oldest = embeddingCache.keys().next().value
    if (oldest) embeddingCache.delete(oldest)
  }
}

export async function embedQueryCached(text: string): Promise<number[]> {
  const key = text.trim().toLowerCase()
  const now = Date.now()
  const cached = embeddingCache.get(key)
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.vec
  }
  const vec = await embedText(text)
  pruneCache()
  embeddingCache.set(key, { vec, ts: now })
  return vec
}

// ─────────────────────────────────────────────────────────
//  Embedding helpers
// ─────────────────────────────────────────────────────────
async function embedText(text: string): Promise<number[]> {
  const generateEmbedding = await getExtractor()
  const output = await generateEmbedding(text, { pooling: 'mean', normalize: true })
  return Array.from(output.data) as number[]
}

function dotProduct(vecA: number[], vecB: number[]): number {
  let dot = 0
  for (let i = 0; i < vecA.length; i++) dot += vecA[i] * vecB[i]
  return dot
}

export const isLocalStoreEnabled = (): boolean => true

// ─────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────
export interface UpsertResult {
  status: 'inserted' | 'updated' | 'blocked_duplicate' | 'blocked_injection'
  aliases_saved?: number
}

export interface SearchResult {
  id: string          // unit_id
  score: number
  question?: string
  answer?: string
  text?: string
  type?: string
}

export interface VectorRow {
  vector_id: string
  unit_id: string
  source_type: string
  phrase: string
  embedding: Buffer
}

// Impact của 1 alias với KB hiện có
export interface AliasImpact {
  phrase: string
  score: number
  unitQuestion: string
}

export interface SuggestedAlias {
  phrase: string
  impact: AliasImpact[]  // top 2 nearest từ OTHER units
}

// ─────────────────────────────────────────────────────────
//  upsertQA — lưu Q&A + aliases vào knowledge_vectors
// ─────────────────────────────────────────────────────────
export async function upsertQA(
  question: string,
  answer: string,
  aliases: string[] = [],
): Promise<UpsertResult> {
  const safeQ = sanitizeInput(question)
  const safeA = sanitizeInput(answer)

  if (safeQ.length < 5) return { status: 'blocked_injection' }

  const canonicalVec = await embedQueryCached(safeQ)

  // DEDUPE CHECK — scan toàn bộ canonical vectors
  const allVectors = db.prepare(`
    SELECT vector_id, unit_id, source_type, phrase, embedding
    FROM knowledge_vectors
    WHERE source_type = 'canonical'
  `).all() as VectorRow[]

  let duplicateUnitId: string | null = null
  let maxSimilarity = 0

  for (const row of allVectors) {
    const sim = dotProduct(canonicalVec, bufferToVector(row.embedding))
    if (sim > maxSimilarity) {
      maxSimilarity = sim
      if (sim >= DEDUPE_THRESHOLD) duplicateUnitId = row.unit_id
    }
  }

  // Clamp aliases
  const safeAliases = aliases
    .map((a) => sanitizeInput(a))
    .filter((a) => a.length >= 3)
    .slice(0, ALIAS_MAX)

  if (duplicateUnitId) {
    // UPDATE existing unit
    await _updateUnit(duplicateUnitId, safeQ, safeA, canonicalVec, safeAliases)
    console.log(`✅ localStore: updated QA (unit=${duplicateUnitId}, sim=${maxSimilarity.toFixed(3)}, aliases=${safeAliases.length})`)
    return { status: 'updated', aliases_saved: safeAliases.length }
  }

  // INSERT new unit
  const unitId = `qa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  await _insertUnit(unitId, safeQ, safeA, canonicalVec, safeAliases)
  console.log(`✅ localStore: inserted QA (unit=${unitId}, aliases=${safeAliases.length})`)
  return { status: 'inserted', aliases_saved: safeAliases.length }
}

async function _insertUnit(
  unitId: string,
  question: string,
  answer: string,
  canonicalVec: number[],
  aliases: string[],
) {
  const canonicalVecId = `vec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const insertUnit = db.prepare(`
    INSERT INTO knowledge_units (id, type, question, answer, text)
    VALUES (?, 'qa', ?, ?, ?)
  `)
  const insertVector = db.prepare(`
    INSERT INTO knowledge_vectors (vector_id, unit_id, source_type, phrase, embedding)
    VALUES (?, ?, ?, ?, ?)
  `)
  const insertFts = db.prepare(`
    INSERT INTO knowledge_fts (vector_id, unit_id, phrase)
    VALUES (?, ?, ?)
  `)

  // Embed aliases
  const aliasEmbeds = await _embedAliases(aliases)

  const txn = db.transaction(() => {
    insertUnit.run(unitId, question, answer, `Q: ${question}\nA: ${answer}`)
    // Canonical vector
    insertVector.run(canonicalVecId, unitId, 'canonical', question, vectorToBuffer(canonicalVec))
    insertFts.run(canonicalVecId, unitId, question)
    // Alias vectors
    for (let i = 0; i < aliases.length; i++) {
      const aliasVecId = `vec-alias-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${i}`
      insertVector.run(aliasVecId, unitId, 'alias', aliases[i], vectorToBuffer(aliasEmbeds[i]))
      insertFts.run(aliasVecId, unitId, aliases[i])
    }
  })

  txn()
}

async function _updateUnit(
  unitId: string,
  question: string,
  answer: string,
  canonicalVec: number[],
  aliases: string[],
) {
  // Embed aliases
  const aliasEmbeds = await _embedAliases(aliases)

  const updateUnit = db.prepare(`
    UPDATE knowledge_units
    SET question = ?, answer = ?, text = ?, updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `)
  // Xóa vectors + FTS cũ của unit
  const deleteVectors = db.prepare(`DELETE FROM knowledge_vectors WHERE unit_id = ?`)
  const deleteFts = db.prepare(`DELETE FROM knowledge_fts WHERE unit_id = ?`)
  const insertVector = db.prepare(`
    INSERT INTO knowledge_vectors (vector_id, unit_id, source_type, phrase, embedding)
    VALUES (?, ?, ?, ?, ?)
  `)
  const insertFts = db.prepare(`
    INSERT INTO knowledge_fts (vector_id, unit_id, phrase)
    VALUES (?, ?, ?)
  `)

  const canonicalVecId = `vec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

  const txn = db.transaction(() => {
    updateUnit.run(question, answer, `Q: ${question}\nA: ${answer}`, unitId)
    deleteVectors.run(unitId)
    deleteFts.run(unitId)
    // Canonical
    insertVector.run(canonicalVecId, unitId, 'canonical', question, vectorToBuffer(canonicalVec))
    insertFts.run(canonicalVecId, unitId, question)
    // Aliases
    for (let i = 0; i < aliases.length; i++) {
      const aliasVecId = `vec-alias-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${i}`
      insertVector.run(aliasVecId, unitId, 'alias', aliases[i], vectorToBuffer(aliasEmbeds[i]))
      insertFts.run(aliasVecId, unitId, aliases[i])
    }
  })

  txn()
}

async function _embedAliases(aliases: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (const alias of aliases) {
    // Alias embedding — không dùng cache (unique phrases, không spam)
    results.push(await embedText(alias))
  }
  return results
}

// ─────────────────────────────────────────────────────────
//  upsertCVChunk (giữ nguyên logic, adapt sang knowledge_vectors)
// ─────────────────────────────────────────────────────────
export async function upsertCVChunk(chunkId: string, text: string, filename: string): Promise<void> {
  const vec = await embedText(text)
  const vectorId = `vec-cv-${chunkId}`

  const deleteUnit = db.prepare('DELETE FROM knowledge_units WHERE id = ?')
  const deleteFts = db.prepare('DELETE FROM knowledge_fts WHERE unit_id = ?')
  const deleteVectors = db.prepare('DELETE FROM knowledge_vectors WHERE unit_id = ?')
  const insertUnit = db.prepare(`
    INSERT INTO knowledge_units (id, type, text, filename)
    VALUES (?, 'cv', ?, ?)
  `)
  const insertVector = db.prepare(`
    INSERT INTO knowledge_vectors (vector_id, unit_id, source_type, phrase, embedding)
    VALUES (?, ?, 'canonical', ?, ?)
  `)
  const insertFts = db.prepare(`
    INSERT INTO knowledge_fts (vector_id, unit_id, phrase)
    VALUES (?, ?, ?)
  `)

  const txn = db.transaction(() => {
    deleteUnit.run(chunkId)
    deleteFts.run(chunkId)
    deleteVectors.run(chunkId)
    insertUnit.run(chunkId, text, filename)
    insertVector.run(vectorId, chunkId, text, vectorToBuffer(vec))
    insertFts.run(vectorId, chunkId, text)
  })

  txn()
  console.log(`✅ localStore: inserted CV chunk (id=${chunkId})`)
}

// ─────────────────────────────────────────────────────────
//  semanticSearch — Unified scan + Adaptive Confidence Gating
//  Runtime mode: topK=5, latency-first
// ─────────────────────────────────────────────────────────
export async function semanticSearch(query: string, topK = 5, relaxedGating = false): Promise<SearchResult[]> {
  const cleanFtsQuery = query.trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()

  // Build FTS query
  let ftsMatchQuery = ''
  if (cleanFtsQuery.length > 2) {
    const keywords = cleanFtsQuery
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => `"${w}"`)
    if (keywords.length > 0) ftsMatchQuery = keywords.join(' OR ')
  }

  // --- LAYER 1: FTS5 MATCH FIRST ---
  // Nếu FTS hit cực kỳ chính xác (score >= 0.88) → skip embedding hoàn toàn
  const ftsUnitScores = new Map<string, number>()  // unit_id → best FTS score

  if (ftsMatchQuery) {
    try {
      const ftsRows = db.prepare(`
        SELECT f.vector_id, f.unit_id, f.phrase, f.rank,
               u.type, u.question, u.answer, u.text
        FROM knowledge_fts f
        JOIN knowledge_units u ON f.unit_id = u.id
        WHERE knowledge_fts MATCH ?
        ORDER BY rank
        LIMIT 30
      `).all(ftsMatchQuery) as {
        vector_id: string; unit_id: string; phrase: string; rank: number
        type: string; question: string | null; answer: string | null; text: string
      }[]

      for (const row of ftsRows) {
        const ftsScore = Math.max(0.1, 1 / (1 + Math.abs(row.rank)))
        const prev = ftsUnitScores.get(row.unit_id) ?? 0
        if (ftsScore > prev) ftsUnitScores.set(row.unit_id, ftsScore)
      }

      // FTS first-hit shortcut — ONLY for live mode
      // Training mode (relaxedGating) luôn đi qua full semantic scan để recall cao hơn
      const topFtsUnit = [...ftsUnitScores.entries()].sort((a, b) => b[1] - a[1])[0]
      if (!relaxedGating && topFtsUnit && topFtsUnit[1] >= 0.88) {
        console.log(`⚡ localStore: FTS First Hit (unit=${topFtsUnit[0]}, score=${topFtsUnit[1].toFixed(3)}) — skipping embedding`)
        return _buildResultsFromUnitIds(
          [...ftsUnitScores.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, topK)
            .map(([uid, score]) => ({ unit_id: uid, score })),
        )
      }
    } catch (err) {
      console.warn('FTS5 search failed:', err)
    }
  }

  // --- LAYER 2: SEMANTIC (Vector) SEARCH ---
  console.log(`🧠 localStore: Semantic search for: "${query}"`)
  try {
    const queryVec = await embedQueryCached(query)

    // Scan ALL knowledge_vectors (1 query — unified canonical + alias)
    const allVectors = db.prepare(`
      SELECT vector_id, unit_id, source_type, phrase, embedding
      FROM knowledge_vectors
    `).all() as VectorRow[]

    // Group by unit_id — giữ max cosine score
    const unitBestScore = new Map<string, number>()
    for (const row of allVectors) {
      const sim = dotProduct(queryVec, bufferToVector(row.embedding))
      const prev = unitBestScore.get(row.unit_id) ?? 0
      if (sim > prev) unitBestScore.set(row.unit_id, sim)
    }

    // Adaptive Confidence Gating + FTS rerank
    const candidates: { unit_id: string; score: number }[] = []
    const queryWords = new Set(
      cleanFtsQuery.split(/\s+/).filter((w) => w.length > 2).map((w) => w.toLowerCase())
    )

    for (const [unit_id, vecScore] of unitBestScore.entries()) {
      const ftsScore = ftsUnitScores.get(unit_id) ?? 0
      let finalScore: number

      if (relaxedGating) {
        // Training mode: accept score >= 0.45 (thấp hơn live mode 0.58)
        // Data nhỏ, không realtime → ưu tiên recall hơn precision
        if (vecScore < 0.45) continue
        finalScore = ftsScore > 0 ? vecScore * 0.65 + ftsScore * 0.35 : vecScore

      } else if (vecScore >= RETRIEVAL_THRESHOLD_HIGH) {
        // Tier 1: High confidence — direct accept
        finalScore = ftsScore > 0 ? vecScore * 0.65 + ftsScore * 0.35 : vecScore

      } else if (vecScore >= RETRIEVAL_THRESHOLD_MID) {
        // Tier 2: Medium confidence — accept directly (vector similarity alone is sufficient)
        // Paraphrase queries ("give me a quick intro" vs trained "tell me about yourself")
        // will not have FTS keyword overlap — that is expected and OK.
        // FTS bonus applied if available, otherwise use vecScore as-is.
        finalScore = ftsScore > 0 ? vecScore * 0.80 + ftsScore * 0.20 : vecScore

      } else if (vecScore >= RETRIEVAL_THRESHOLD_LOW) {
        // Tier 3: Weak confidence — cần keyword overlap trong matched phrase
        const hasKeyword = _unitHasKeywordOverlap(unit_id, queryWords)
        if (!hasKeyword) continue  // reject
        finalScore = vecScore

      } else {
        continue  // below minimum threshold — reject
      }

      candidates.push({ unit_id, score: finalScore })
    }

    return _buildResultsFromUnitIds(
      candidates.sort((a, b) => b.score - a.score).slice(0, topK),
    )
  } catch (err) {
    console.error('❌ localStore semantic search failed:', err)
    return _fallbackFTSSearch(query, topK)
  }
}

// ─────────────────────────────────────────────────────────
//  scanAllVectors — Training mode utility (no topK limit)
//  Dùng bởi suggest-aliases: full precision scan
// ─────────────────────────────────────────────────────────
export async function scanAllVectors(
  queryVec: number[],
  excludeUnitId?: string,
): Promise<{ unit_id: string; phrase: string; score: number; question: string }[]> {
  const allVectors = db.prepare(`
    SELECT v.vector_id, v.unit_id, v.phrase, v.embedding,
           u.question
    FROM knowledge_vectors v
    JOIN knowledge_units u ON v.unit_id = u.id
    ${excludeUnitId ? 'WHERE v.unit_id != ?' : ''}
  `).all(...(excludeUnitId ? [excludeUnitId] : [])) as {
    vector_id: string; unit_id: string; phrase: string; embedding: Buffer; question: string | null
  }[]

  const results = allVectors.map((row) => ({
    unit_id: row.unit_id,
    phrase: row.phrase,
    score: dotProduct(queryVec, bufferToVector(row.embedding)),
    question: row.question ?? '',
  }))

  return results.sort((a, b) => b.score - a.score)
}

// ─────────────────────────────────────────────────────────
//  checkAliasCollision — Training: kiểm tra alias có đụng độ với KB không
//  Strict threshold = COLLISION_THRESHOLD (0.88)
//  Trả về true nếu alias AN TOÀN (không collision)
// ─────────────────────────────────────────────────────────
export async function checkAliasCollision(
  aliasPhrase: string,
  currentUnitId: string | null,
): Promise<{ safe: boolean; collidesWith?: { phrase: string; score: number; question: string } }> {
  const aliasVec = await embedText(aliasPhrase)
  // Full scan, exclude current unit
  const results = await scanAllVectors(aliasVec, currentUnitId ?? undefined)

  if (results.length === 0) return { safe: true }

  const top = results[0]
  if (top.score >= COLLISION_THRESHOLD) {
    return {
      safe: false,
      collidesWith: { phrase: top.phrase, score: top.score, question: top.question },
    }
  }

  return { safe: true }
}

// ─────────────────────────────────────────────────────────
//  computeAliasImpact — Training: tính retrieval impact của 1 alias
//  Lấy top 2 nearest từ OTHER units (cho UI warning)
// ─────────────────────────────────────────────────────────
export async function computeAliasImpact(
  aliasPhrase: string,
  currentUnitId: string | null,
): Promise<AliasImpact[]> {
  const aliasVec = await embedText(aliasPhrase)
  const results = await scanAllVectors(aliasVec, currentUnitId ?? undefined)

  return results.slice(0, 2).map((r) => ({
    phrase: r.phrase,
    score: r.score,
    unitQuestion: r.question,
  }))
}

// ─────────────────────────────────────────────────────────
//  Internal helpers
// ─────────────────────────────────────────────────────────
function _unitHasKeywordOverlap(unit_id: string, queryWords: Set<string>): boolean {
  if (queryWords.size === 0) return false
  const phrases = db.prepare(`SELECT phrase FROM knowledge_vectors WHERE unit_id = ?`).all(unit_id) as { phrase: string }[]
  for (const { phrase } of phrases) {
    const words = phrase.toLowerCase().split(/\s+/)
    if (words.some((w) => queryWords.has(w))) return true
  }
  return false
}

function _buildResultsFromUnitIds(
  items: { unit_id: string; score: number }[],
): SearchResult[] {
  const results: SearchResult[] = []
  const getUnit = db.prepare(`SELECT type, question, answer, text FROM knowledge_units WHERE id = ?`)
  for (const { unit_id, score } of items) {
    const unit = getUnit.get(unit_id) as { type: string; question: string | null; answer: string | null; text: string } | undefined
    if (unit) {
      results.push({
        id: unit_id,
        score,
        question: unit.question ?? undefined,
        answer: unit.answer ?? undefined,
        text: unit.text,
        type: unit.type,
      })
    }
  }
  return results
}

function _fallbackFTSSearch(query: string, topK: number): SearchResult[] {
  const clean = query.trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const keywords = clean.split(/\s+/).filter((w) => w.length > 2).map((w) => `"${w}"`)
  if (keywords.length === 0) return []

  try {
    const rows = db.prepare(`
      SELECT f.unit_id, f.phrase, f.rank,
             u.type, u.question, u.answer, u.text
      FROM knowledge_fts f
      JOIN knowledge_units u ON f.unit_id = u.id
      WHERE knowledge_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(keywords.join(' OR '), topK) as {
      unit_id: string; phrase: string; rank: number
      type: string; question: string | null; answer: string | null; text: string
    }[]

    // Dedupe by unit_id
    const seen = new Set<string>()
    return rows
      .filter((r) => { if (seen.has(r.unit_id)) return false; seen.add(r.unit_id); return true })
      .map((r) => ({
        id: r.unit_id,
        score: Math.max(0.5, 1 / (1 + Math.abs(r.rank))),
        question: r.question ?? undefined,
        answer: r.answer ?? undefined,
        text: r.text,
        type: r.type,
      }))
  } catch (err) {
    console.error('Fallback FTS search failed:', err)
    return []
  }
}
