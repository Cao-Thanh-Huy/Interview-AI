import { Hono } from 'hono'
import { safePdfParse } from '../lib/pdfParser.js'
import { pdfStore } from '../lib/pdfStore.js'

export const pdfRouter = new Hono()

function splitIntoChunks(text: string, wordsPerChunk = 300): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const chunks: string[] = []
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(' '))
  }
  return chunks
}

pdfRouter.post('/', async (c) => {
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ error: 'Invalid form data' }, 400)
  }

  const file = formData.get('file') as File | null
  if (!file) return c.json({ error: 'No file provided' }, 400)
  if (file.type !== 'application/pdf') return c.json({ error: 'Only PDF files are allowed' }, 400)
  if (file.size > 10 * 1024 * 1024) return c.json({ error: 'File too large (max 10MB)' }, 413)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const pdfData = await safePdfParse(buffer)
    const fullText = pdfData.text.trim()

    if (!fullText) {
      return c.json({ error: 'Could not extract text from PDF' }, 422)
    }

    const chunks = splitIntoChunks(fullText)
    pdfStore.store(file.name, chunks, fullText)

    return c.json({ filename: file.name, size: file.size, chunks: chunks.length })
  } catch (err) {
    console.error('PDF parse error:', err)
    return c.json({ error: 'Failed to process PDF' }, 500)
  }
})

pdfRouter.delete('/:filename', (c) => {
  const filename = decodeURIComponent(c.req.param('filename'))
  pdfStore.delete(filename)
  return c.json({ message: 'Deleted' })
})

pdfRouter.get('/', (c) => c.json({ documents: pdfStore.list() }))
