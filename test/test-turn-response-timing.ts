// Test script for InterviewScreen per-turn response timing
// Usage: Run with `npx tsx test/test-turn-response-timing.ts` (requires tsx installed)
// This script simulates sending multiple utterances to the backend and measures response time for each turn and the summary turn.

import fetch from 'node-fetch'

const API_URL = 'http://127.0.0.1:3001/api/completion' // Adjust if needed
const CONTEXT = 'Test context'
const SESSION_ID = 'test-session-001'
const HISTORY: any[] = []


// Simulate sending a turn (utterance) and measure both time to first chunk and total time
async function sendTurn(text: string) {
  const start = Date.now()
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: text,
      context: CONTEXT,
      mode: 'copilot',
      sessionId: SESSION_ID,
      history: HISTORY,
    }),
  })
  let answer = ''
  let firstChunkMs: number | null = null
  for await (const chunk of res.body as any) {
    if (firstChunkMs === null) firstChunkMs = Date.now() - start
    answer += chunk.toString()
  }
  const end = Date.now()
  return { text, answer, ms: end - start, firstChunkMs }
}

async function main() {
  const utterances = [
    'Xin chào, tôi là AI.',
    'Tôi sẽ trả lời các câu hỏi của bạn.',
    'Bạn có thể hỏi bất cứ điều gì.',
  ]
  const results: any[] = []
  for (const u of utterances) {
    const r = await sendTurn(u)
    console.log(`[Turn] "${u}" → first chunk: ${r.firstChunkMs}ms, total: ${r.ms}ms`)
    results.push(r)
    await new Promise((res) => setTimeout(res, 500)) // simulate user pause
  }
  // Simulate summary turn (after 2s silence)
  console.log('Waiting 2.2s for summary turn...')
  await new Promise((res) => setTimeout(res, 2200))
  const summaryText = utterances.join(' ')
  const summary = await sendTurn(summaryText)
  console.log(`[Summary] "${summaryText}" → first chunk: ${summary.firstChunkMs}ms, total: ${summary.ms}ms`)
  results.push({ ...summary, isSummary: true })
  // Print all results
  console.log('\n--- Results ---')
  results.forEach((r, i) => {
    const label = r.isSummary ? 'Summary' : `Turn ${i + 1}`
    console.log(`${label}: first chunk: ${r.firstChunkMs}ms, total: ${r.ms}ms | Q: ${r.text}`)
  })
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
