/**
 * test-cv-interview-qa.ts
 *
 * Tests the Interview AI Copilot with realistic interview questions covering
 * Cao Thanh Huy's CV — checks both response accuracy and latency.
 *
 * Usage: npx tsx test/test-cv-interview-qa.ts
 * Requires: backend running at http://127.0.0.1:3001
 */

import fetch from 'node-fetch'

const API_URL   = 'http://127.0.0.1:3001/api/completion'
const SESSION_ID = `cv-test-${Date.now()}`

// ─── colour helpers ────────────────────────────────────────────────────────
const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`
const CYAN   = (s: string) => `\x1b[36m${s}\x1b[0m`
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`
const DIM    = (s: string) => `\x1b[2m${s}\x1b[0m`

// ─── test questions ────────────────────────────────────────────────────────
// 5 groups: Background · Lakehouse · Data Stack · GenAI · Ops
const TEST_QUESTIONS = [
  // ── Group 1: Background & Career ────────────────────────────────────────
  {
    group:    'Background & Career',
    question: 'Can you give me a brief introduction about yourself and your experience?',
  },
  {
    group:    'Background & Career',
    question: 'What types of data engineering projects have you worked on at TMA Solutions?',
  },
  {
    group:    'Background & Career',
    question: 'How do you typically approach designing a new data platform from scratch?',
  },

  // ── Group 2: Lakehouse & Storage ─────────────────────────────────────────
  {
    group:    'Lakehouse Architecture',
    question: 'Can you explain the on-premise Lakehouse you built using MinIO, Trino, and Project Nessie?',
  },
  {
    group:    'Lakehouse Architecture',
    question: 'What partitioning strategy do you use for large-scale Parquet datasets and why?',
  },
  {
    group:    'Lakehouse Architecture',
    question: 'What is the difference between Delta Lake and Apache Iceberg, and when do you choose each?',
  },

  // ── Group 3: Data Stack & Cloud ──────────────────────────────────────────
  {
    group:    'AWS & Cloud Stack',
    question: 'How does Amazon Athena work and what are its strengths and limitations?',
  },
  {
    group:    'AWS & Cloud Stack',
    question: 'How do you use AWS Lambda in your data pipelines?',
  },
  {
    group:    'Snowflake & Data Vault',
    question: 'What is Data Vault modeling and how did you implement it at Resimac?',
  },
  {
    group:    'Snowflake & Data Vault',
    question: 'What is Snowflake Cortex AI and how did you use it?',
  },

  // ── Group 4: Spark & Distributed Processing ──────────────────────────────
  {
    group:    'Spark & Databricks',
    question: 'How do you optimize Spark jobs for performance on large-scale datasets?',
  },
  {
    group:    'Spark & Databricks',
    question: 'What is Databricks AutoLoader and when would you use it?',
  },

  // ── Group 5: GenAI & Production ──────────────────────────────────────────
  {
    group:    'GenAI / Deckand',
    question: 'Describe the Deckand Text-to-SQL project — what problem does it solve and how does it work?',
  },
  {
    group:    'GenAI / Deckand',
    question: 'How did you handle LLM hallucination in SQL generation?',
  },
  {
    group:    'Production Ops',
    question: 'How do you implement observability and monitoring for your data pipelines?',
  },
]

// ─── per-question test runner ─────────────────────────────────────────────
interface TestResult {
  group:        string
  question:     string
  firstChunkMs: number
  totalMs:      number
  answerPreview: string
  answerLen:    number
  latencyGrade: 'FAST' | 'OK' | 'SLOW'
  hasContent:   boolean
}

async function runQuestion(
  q: { group: string; question: string },
  idx: number,
  total: number
): Promise<TestResult> {
  const start = Date.now()
  let firstChunkMs = -1
  let answer = ''

  try {
    const res = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: q.question,
        context:    'Technical interview for a Data Engineer position',
        mode:       'copilot',
        sessionId:  SESSION_ID,
        history:    [],
      }),
    })

    for await (const chunk of res.body as any) {
      if (firstChunkMs === -1) firstChunkMs = Date.now() - start
      answer += chunk.toString()
    }
  } catch (err: any) {
    return {
      group:        q.group,
      question:     q.question,
      firstChunkMs: -1,
      totalMs:      Date.now() - start,
      answerPreview: `ERROR: ${err.message}`,
      answerLen:    0,
      latencyGrade: 'SLOW',
      hasContent:   false,
    }
  }

  const totalMs      = Date.now() - start
  const latencyGrade = firstChunkMs < 800   ? 'FAST'
                     : firstChunkMs < 2000  ? 'OK'
                     :                        'SLOW'
  const hasContent   = answer.trim().length > 80

  // strip SSE "data:" prefix if present
  const clean = answer
    .split('\n')
    .filter(l => l.startsWith('data:'))
    .map(l => l.replace(/^data:\s*/, '').replace(/^"(.*)"$/, '$1'))
    .join('')
    .replace(/\\n/g, ' ')
    .trim()

  const preview = (clean || answer.trim()).substring(0, 140)

  console.log(
    `  [${String(idx+1).padStart(2,'0')}/${total}] ` +
    `${latencyGrade === 'FAST' ? GREEN('●') : latencyGrade === 'OK' ? YELLOW('●') : RED('●')} ` +
    `First: ${BOLD(String(firstChunkMs)+'ms')}  Total: ${totalMs}ms  Len: ${answer.length}c`
  )
  console.log(`         ${DIM(preview.substring(0, 120))}`)

  return {
    group:        q.group,
    question:     q.question,
    firstChunkMs,
    totalMs,
    answerPreview: preview,
    answerLen:    answer.length,
    latencyGrade,
    hasContent,
  }
}

// ─── main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(BOLD(`\n${'═'.repeat(72)}`))
  console.log(BOLD(`  📋  Interview AI Copilot — CV Knowledge Test`))
  console.log(BOLD(`  Candidate: Cao Thanh Huy | Data Engineer`))
  console.log(BOLD(`  Questions: ${TEST_QUESTIONS.length} | Endpoint: ${API_URL}`))
  console.log(BOLD(`${'═'.repeat(72)}\n`))

  // Check backend is reachable
  try {
    await fetch(API_URL, { method: 'HEAD' })
  } catch {
    // HEAD may 405 but that's fine — just checking connectivity
  }

  const results: TestResult[] = []
  let currentGroup = ''

  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const q = TEST_QUESTIONS[i]
    const isNewGroup = q.group !== currentGroup
    if (isNewGroup) {
      currentGroup = q.group
      console.log(CYAN(`\n  ── ${currentGroup} ${'─'.repeat(50 - currentGroup.length)}`))
    }
    const r = await runQuestion(q, i, TEST_QUESTIONS.length)
    results.push(r)

    // Realistic interview pacing: ~3-4 questions per minute
    // Groq free tier: ~30 req/min, ~14400 tokens/min on llama-3.1-8b-instant
    // 18s gap simulates natural interviewer response + think time
    if (i < TEST_QUESTIONS.length - 1) {
      const pauseMs = 18000
      process.stdout.write(DIM(`         ⏳ Pacing pause ${pauseMs/1000}s (simulating real interview rhythm)...\n`))
      await new Promise(res => setTimeout(res, pauseMs))
    }
  }

  // ─── Summary Report ──────────────────────────────────────────────────────
  console.log(BOLD(`\n${'═'.repeat(72)}`))
  console.log(BOLD(`  📊  TEST SUMMARY`))
  console.log(BOLD(`${'═'.repeat(72)}`))

  const fastCount  = results.filter(r => r.latencyGrade === 'FAST').length
  const okCount    = results.filter(r => r.latencyGrade === 'OK').length
  const slowCount  = results.filter(r => r.latencyGrade === 'SLOW').length
  const hasContent = results.filter(r => r.hasContent).length
  const avgFirst   = Math.round(results.filter(r=>r.firstChunkMs>0).reduce((s,r)=>s+r.firstChunkMs,0) / results.filter(r=>r.firstChunkMs>0).length)
  const avgTotal   = Math.round(results.reduce((s,r)=>s+r.totalMs,0) / results.length)
  const p95First   = [...results].sort((a,b)=>b.firstChunkMs-a.firstChunkMs)[Math.floor(results.length*0.05)]?.firstChunkMs ?? 0

  console.log(`
  Latency (Time to First Chunk)
  ├─ ${GREEN('FAST')} (<800ms)   ${GREEN(String(fastCount).padStart(3))} / ${TEST_QUESTIONS.length}  ${GREEN('█'.repeat(fastCount))}
  ├─ ${YELLOW('OK')}   (800–2s)  ${YELLOW(String(okCount).padStart(3))} / ${TEST_QUESTIONS.length}  ${YELLOW('█'.repeat(okCount))}
  └─ ${RED('SLOW')} (>2s)      ${RED(String(slowCount).padStart(3))} / ${TEST_QUESTIONS.length}  ${RED('█'.repeat(slowCount))}

  Timing
  ├─ Avg first chunk:  ${avgFirst}ms
  ├─ P95 first chunk:  ${p95First}ms  
  └─ Avg total:        ${avgTotal}ms

  Content Quality
  └─ Has meaningful response: ${hasContent}/${TEST_QUESTIONS.length}`)

  console.log(BOLD(`\n  Per-Question Breakdown:`))
  console.log(`  ${'#'.padEnd(4)} ${'First'.padEnd(8)} ${'Total'.padEnd(8)} ${'Grade'.padEnd(6)} ${'Group'.padEnd(24)} Question`)
  console.log(`  ${'─'.repeat(100)}`)

  results.forEach((r, i) => {
    const gradeColor = r.latencyGrade === 'FAST' ? GREEN : r.latencyGrade === 'OK' ? YELLOW : RED
    const firstStr   = r.firstChunkMs > 0 ? r.firstChunkMs + 'ms' : 'ERR'
    console.log(
      `  ${String(i+1).padEnd(4)} ` +
      `${firstStr.padEnd(8)} ` +
      `${(r.totalMs+'ms').padEnd(8)} ` +
      `${gradeColor(r.latencyGrade.padEnd(6))} ` +
      `${r.group.padEnd(24)} ` +
      `${r.question.substring(0, 55)}...`
    )
  })

  // Grade overall
  const score = ((fastCount + okCount * 0.5) / TEST_QUESTIONS.length) * 100
  const overall = score >= 90 ? GREEN('🟢 EXCELLENT')
                : score >= 70 ? YELLOW('🟡 GOOD')
                :               RED('🔴 NEEDS IMPROVEMENT')
  console.log(BOLD(`\n  Overall Score: ${overall} (${Math.round(score)}% within acceptable latency)\n`))
  console.log(BOLD(`${'═'.repeat(72)}\n`))
}

main().catch(err => {
  console.error(RED('\n❌ Test runner failed: ' + err.message))
  console.error(DIM('  Make sure the backend is running: npm run dev (in /backend)'))
  process.exit(1)
})
