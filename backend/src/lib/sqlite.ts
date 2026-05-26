import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DB_DIR = path.resolve(__dirname, '..', '..', 'data')
const DB_PATH = path.join(DB_DIR, 'memory.db')

// Đảm bảo thư mục dữ liệu tồn tại
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true })
}

// Khởi tạo Database SQLite
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL') // Tối ưu hóa ghi đồng thời và tốc độ
db.pragma('synchronous = NORMAL')

// Khởi tạo database schema
function initSchema() {
  // 1. Bảng tri thức cốt lõi
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_units (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      question TEXT,
      answer TEXT,
      text TEXT NOT NULL,
      filename TEXT,
      tags TEXT,
      quality_score REAL DEFAULT 1.0,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `)

  // 2. Bảng lưu trữ vector embeddings dưới dạng BLOB
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_embeddings (
      id TEXT PRIMARY KEY,
      embedding BLOB NOT NULL,
      FOREIGN KEY(id) REFERENCES knowledge_units(id) ON DELETE CASCADE
    );
  `)

  // 3. Bảng ảo FTS5 để tìm kiếm full-text search siêu tốc
  // Do FTS5 không hỗ trợ foreign keys hoặc triggers phức tạp một cách đơn giản,
  // chúng ta sẽ đồng bộ thủ công thông qua code Node.js khi ghi/xóa dữ liệu.
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      id,
      question,
      text,
      tokenize='porter'
    );
  `)

  console.log('✅ SQLite database schema initialized')
}

initSchema()

// --- Vector conversion helpers ---

/**
 * Chuyển đổi một mảng số thực (Float32Array) thành Buffer nhị phân để lưu vào SQLite BLOB.
 */
export function vectorToBuffer(vector: number[]): Buffer {
  const floatArray = new Float32Array(vector)
  return Buffer.from(floatArray.buffer, floatArray.byteOffset, floatArray.byteLength)
}

/**
 * Khôi phục mảng số thực (number[]) từ Buffer nhị phân đọc ra từ SQLite BLOB.
 */
export function bufferToVector(buffer: Buffer): number[] {
  const floatArray = new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
  )
  return Array.from(floatArray)
}

export default db as any

