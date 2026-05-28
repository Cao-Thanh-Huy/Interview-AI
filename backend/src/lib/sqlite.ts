import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

// Data directory: always relative to process.cwd()
//   Dev:        npm run dev from backend/  → cwd = backend/ → data = backend/data/
//   Production: VBS launcher sets cwd = {install_dir} → data = {install_dir}/data/
const DB_DIR  = path.resolve(process.cwd(), 'data')
const DB_PATH = path.join(DB_DIR, 'memory.db')

if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

const db = new Database(DB_PATH)
db.pragma('journal_mode = DELETE')  // DELETE mode: mỗi write ghi thẳng vào memory.db (không qua WAL)
                                    // → Git thấy thay đổi ngay sau khi stop backend
db.pragma('synchronous = NORMAL')

function initSchema() {
  // 1. knowledge_units — giữ nguyên structure (backward compat)
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_units (
      id            TEXT PRIMARY KEY,
      type          TEXT NOT NULL,
      question      TEXT,
      answer        TEXT,
      text          TEXT NOT NULL,
      filename      TEXT,
      tags          TEXT,
      quality_score REAL DEFAULT 1.0,
      created_at    TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at    TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `)

  // 2. knowledge_vectors — unified embedding table (canonical + alias)
  //    Thay thế knowledge_embeddings + knowledge_aliases + knowledge_alias_embeddings
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_vectors (
      vector_id   TEXT PRIMARY KEY,
      unit_id     TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'canonical',
      phrase      TEXT NOT NULL,
      embedding   BLOB NOT NULL,
      FOREIGN KEY(unit_id) REFERENCES knowledge_units(id) ON DELETE CASCADE
    );
  `)

  // 3. knowledge_fts — per-phrase indexing (thay vì per-unit blob)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      vector_id,
      unit_id,
      phrase,
      tokenize='porter'
    );
  `)

  console.log('✅ SQLite schema initialized (v2: knowledge_vectors + per-phrase FTS)')

  // Auto-migration: knowledge_embeddings (cũ) → knowledge_vectors (mới)
  runMigration()
}

function runMigration() {
  // ── Bước 0: Drop FTS cũ nếu schema sai (có cột 'id' thay vì 'vector_id') ──
  const ftsHasOldSchema = (() => {
    try {
      // Thử INSERT với schema mới — nếu lỗi "no column named vector_id" thì cần rebuild
      db.prepare(`SELECT vector_id FROM knowledge_fts LIMIT 1`).all()
      return false
    } catch {
      return true  // schema cũ
    }
  })()

  if (ftsHasOldSchema) {
    console.log('🔄 Rebuilding knowledge_fts (schema upgrade: per-phrase indexing)...')
    db.exec(`DROP TABLE IF EXISTS knowledge_fts`)
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
        vector_id,
        unit_id,
        phrase,
        tokenize='porter'
      );
    `)
    console.log('✅ knowledge_fts rebuilt with new schema')
  }

  // ── Bước 1: Migrate knowledge_embeddings → knowledge_vectors ──
  const oldTableExists = (db.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_embeddings'`
  ).get()) as { name: string } | undefined

  if (!oldTableExists) return

  const alreadyMigrated = (db.prepare(
    `SELECT count(*) as c FROM knowledge_vectors WHERE source_type = 'canonical'`
  ).get()) as { c: number }

  if (alreadyMigrated.c > 0) {
    console.log('✅ Vector migration already done, skipping.')
    return
  }

  const oldRecords = db.prepare(`
    SELECT e.id, e.embedding, u.question, u.type
    FROM knowledge_embeddings e
    JOIN knowledge_units u ON e.id = u.id
  `).all() as { id: string; embedding: Buffer; question: string | null; type: string }[]

  if (oldRecords.length === 0) return

  console.log(`🔄 Migrating ${oldRecords.length} records knowledge_embeddings → knowledge_vectors...`)

  const insertVector = db.prepare(`
    INSERT OR IGNORE INTO knowledge_vectors (vector_id, unit_id, source_type, phrase, embedding)
    VALUES (?, ?, 'canonical', ?, ?)
  `)
  const insertFts = db.prepare(`
    INSERT OR IGNORE INTO knowledge_fts (vector_id, unit_id, phrase)
    VALUES (?, ?, ?)
  `)

  const migrate = db.transaction(() => {
    for (const rec of oldRecords) {
      const phrase = rec.question ?? `unit-${rec.id}`
      const vectorId = `vec-migrated-${rec.id}`
      insertVector.run(vectorId, rec.id, phrase, rec.embedding)
      insertFts.run(vectorId, rec.id, phrase)
    }
  })

  migrate()
  console.log(`✅ Migration complete: ${oldRecords.length} canonical vectors migrated.`)
}

initSchema()

// --- Vector conversion helpers ---

export function vectorToBuffer(vector: number[]): Buffer {
  const floatArray = new Float32Array(vector)
  return Buffer.from(floatArray.buffer, floatArray.byteOffset, floatArray.byteLength)
}

export function bufferToVector(buffer: Buffer): number[] {
  const floatArray = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
  )
  return Array.from(floatArray)
}

export default db as any
