import fs from 'node:fs'
import path from 'node:path'

const STORE_PATH = path.resolve('data', 'pdf-store.json')

interface StoredDoc {
  filename: string
  chunks: string[]
  fullText: string
  uploadedAt: string
}

class PDFStore {
  private docs = new Map<string, StoredDoc>()
  private activeFilename: string | null = null

  constructor() {
    this.loadFromDisk()
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(STORE_PATH)) return
      const raw = fs.readFileSync(STORE_PATH, 'utf-8')
      const saved: { docs: Record<string, StoredDoc>; activeFilename: string | null } =
        JSON.parse(raw)
      for (const [k, v] of Object.entries(saved.docs)) {
        this.docs.set(k, v)
      }
      this.activeFilename = saved.activeFilename ?? null
      console.log(`📄 pdfStore: loaded ${this.docs.size} doc(s) from disk`)
    } catch {
      // ignore corrupt/missing data
    }
  }

  private saveToDisk(): void {
    try {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true })
      const payload = {
        docs: Object.fromEntries(this.docs),
        activeFilename: this.activeFilename,
      }
      fs.writeFileSync(STORE_PATH, JSON.stringify(payload), 'utf-8')
    } catch (err) {
      console.error('pdfStore: failed to save to disk', err)
    }
  }

  store(filename: string, chunks: string[], fullText: string): void {
    this.docs.set(filename, {
      filename,
      chunks,
      fullText,
      uploadedAt: new Date().toISOString(),
    })
    this.activeFilename = filename
    this.saveToDisk()
    console.log(`📄 pdfStore: stored "${filename}" (${chunks.length} chunks)`)
  }

  delete(filename: string): void {
    this.docs.delete(filename)
    if (this.activeFilename === filename) {
      const remaining = [...this.docs.keys()]
      this.activeFilename = remaining.at(-1) ?? null
    }
    this.saveToDisk()
  }

  search(query: string, topK = 5): string[] {
    if (!this.activeFilename) return []
    const doc = this.docs.get(this.activeFilename)
    if (!doc || doc.chunks.length === 0) return []

    const queryWords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)

    // Always include the first chunk (CV header / personal info)
    const headerChunk = doc.chunks[0]

    if (queryWords.length === 0) {
      return doc.chunks.slice(0, topK)
    }

    const scored = doc.chunks.map((chunk) => {
      const lower = chunk.toLowerCase()
      const score = queryWords.filter((w) => lower.includes(w)).length
      return { chunk, score }
    })

    const relevant = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.chunk)

    // Merge: header always first, then relevant chunks (deduped)
    const merged = [headerChunk, ...relevant.filter((c) => c !== headerChunk)]
    return merged.slice(0, topK)
  }

  list(): string[] {
    return [...this.docs.keys()]
  }

  hasContent(): boolean {
    return this.activeFilename !== null && this.docs.has(this.activeFilename)
  }
}

export const pdfStore = new PDFStore()
