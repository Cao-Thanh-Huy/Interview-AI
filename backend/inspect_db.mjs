import Database from 'better-sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Check memory.db - the actual DB with data
const db = new Database('./data/memory.db')

console.log('=== TABLES in memory.db ===')
db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().forEach(r => console.log(' -', r.name))

console.log('\n=== ROW COUNTS ===')
for (const t of ['knowledge_entries', 'knowledge_vectors', 'cv_chunks', 'knowledge', 'entries', 'memories']) {
  try { console.log(` ${t}:`, db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get()?.c, 'rows') } catch { }
}

// Try any table we find
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
tables.forEach(({ name }) => {
  try {
    const count = db.prepare(`SELECT COUNT(*) as c FROM [${name}]`).get()?.c
    const cols = db.prepare(`PRAGMA table_info([${name}])`).all().map(c => c.name).join(', ')
    console.log(`\n[${name}] ${count} rows | cols: ${cols}`)
    const sample = db.prepare(`SELECT * FROM [${name}] LIMIT 3`).all()
    sample.forEach((r, i) => {
      const str = JSON.stringify(r)
      console.log(`  row${i+1}: ${str.slice(0, 200)}`)
    })
  } catch(e) { console.log(name, 'err:', e.message) }
})
