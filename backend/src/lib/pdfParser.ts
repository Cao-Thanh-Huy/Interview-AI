import fs from 'fs'
import path from 'path'

// pdf-parse tries to read a test file during init — ensure it exists
const TEST_PDF_PATH = path.join(process.cwd(), 'test', 'data', '05-versions-space.pdf')

function ensureTestPdf(): void {
  const dir = path.dirname(TEST_PDF_PATH)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  if (!fs.existsSync(TEST_PDF_PATH)) {
    // Minimal valid PDF stub
    fs.writeFileSync(TEST_PDF_PATH, Buffer.from('%PDF-1.4\n%%EOF\n'))
    console.log('🔧 Created pdf-parse stub file')
  }
}

export async function safePdfParse(buffer: Buffer): Promise<{ text: string; numpages: number }> {
  ensureTestPdf()
  const { default: pdfParse } = await import('pdf-parse')
  return pdfParse(buffer)
}
