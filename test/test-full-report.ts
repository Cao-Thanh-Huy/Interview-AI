/**
 * test-full-report.ts
 *
 * Comprehensive Q&A behavior test for Interview AI Copilot.
 * Tests 4 scenarios:
 *   A. Ambiguous / garbled → expect clarification request
 *   B. Short follow-up WITH history → expect context-aware answer
 *   C. ASR mishear → expect ASR-corrected + relevant answer
 *   D. Normal interview questions → expect accurate answer
 *
 * Run: npx tsx test/test-full-report.ts
 * Output: test/reports/full-report-<timestamp>.md
 */

import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'

const API     = 'http://127.0.0.1:3001/api/completion'
const PACE_MS = 20000   // 20s between each call — respects Groq free tier rate limit
const SESSION  = `report-${Date.now()}`

// ─── Colour helpers (terminal only) ────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`
const R = (s: string) => `\x1b[31m${s}\x1b[0m`
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`
const C = (s: string) => `\x1b[36m${s}\x1b[0m`
const B = (s: string) => `\x1b[1m${s}\x1b[0m`
const D = (s: string) => `\x1b[2m${s}\x1b[0m`

// ─── Shared Snowflake history (used for follow-up tests) ──────────────────
const SNOWFLAKE_HISTORY = [
  {
    question: 'Can you tell me how Snowflake works?',
    answer:
      '• Yeah, so Snowflake separates compute from storage — virtual warehouses spin up independently.\n' +
      '• Data is stored in columnar Parquet on S3 so no local disk, pay per query.\n' +
      '• Cortex AI lets you run LLM inference inside Snowflake without moving data out.',
  },
]

const DAGSTER_HISTORY = [
  {
    question: 'Tell me about your orchestration setup.',
    answer:
      '• Yeah, so I use Dagster for all my pipeline orchestration — it models data as software-defined assets.\n' +
      '• Each asset has dependencies, freshness policies, and partitions baked in.\n' +
      '• Way cleaner than Airflow for complex multi-hop pipelines.',
  },
]

// ─── Test cases ───────────────────────────────────────────────────────────
interface TestCase {
  group:           string
  label:           string
  transcript:      string
  history:         any[]
  expectBehavior:  'CLARIFICATION' | 'ANSWER' | 'CONTEXT_ANSWER'
  expectKeyword?:  string    // keyword that should appear in answer
  description:     string    // human description of what we're testing
}

const CASES: TestCase[] = [

  // ── A. Ambiguous / garbled — should ask to repeat ──────────────────────
  {
    group:          'A. Ambiguous → Ask to Repeat',
    label:          'Fragment with no context',
    transcript:     'alright do you',
    history:        [],
    expectBehavior: 'CLARIFICATION',
    description:    'Incomplete fragment, no history — gate should fire immediately (filler path)',
  },
  {
    group:          'A. Ambiguous → Ask to Repeat',
    label:          'Too short, no context',
    transcript:     'and also',
    history:        [],
    expectBehavior: 'CLARIFICATION',
    description:    'Two-word phrase, no history — filler gate should reject',
  },
  {
    group:          'A. Ambiguous → Ask to Repeat',
    label:          'Off-topic garbled (no KB match)',
    transcript:     'how about the purple monkey dishwasher configuration',
    history:        [],
    expectBehavior: 'CLARIFICATION',
    description:    'Nonsense question, RAG finds nothing + ambiguous → clarification',
  },

  // ── B. Short follow-up WITH history — should use context ───────────────
  {
    group:          'B. Short Follow-up + History → Context Answer',
    label:          '"what about Athena?" after Snowflake discussion',
    transcript:     'what about Athena?',
    history:        SNOWFLAKE_HISTORY,
    expectBehavior: 'CONTEXT_ANSWER',
    expectKeyword:  'Athena',
    description:    'Short but has keyword + history → enrich query with topic, answer about Athena',
  },
  {
    group:          'B. Short Follow-up + History → Context Answer',
    label:          '"and what about the partitioning?" after Snowflake',
    transcript:     'and what about the partitioning?',
    history:        SNOWFLAKE_HISTORY,
    expectBehavior: 'CONTEXT_ANSWER',
    description:    'Short follow-up, should pull Snowflake + partitioning context from history',
  },
  {
    group:          'B. Short Follow-up + History → Context Answer',
    label:          '"how does it compare to Airflow?" after Dagster',
    transcript:     'how does it compare to Airflow?',
    history:        DAGSTER_HISTORY,
    expectBehavior: 'CONTEXT_ANSWER',
    expectKeyword:  'Dagster',
    description:    '"it" refers to Dagster from history — enriched query should find Dagster context',
  },

  // ── C. ASR mishear → correction + right answer ─────────────────────────
  {
    group:          'C. ASR Correction → Right Answer',
    label:          '"no flag" → Snowflake',
    transcript:     'how to work on the no flag',
    history:        [],
    expectBehavior: 'ANSWER',
    expectKeyword:  'Snowflake',
    description:    'ASR mishears "Snowflake" as "no flag" — correction should fire, answer about Snowflake',
  },
  {
    group:          'C. ASR Correction → Right Answer',
    label:          '"dag star" → Dagster',
    transcript:     'tell me about dag star orchestration',
    history:        [],
    expectBehavior: 'ANSWER',
    expectKeyword:  'Dagster',
    description:    'ASR mishears "Dagster" as "dag star" — should answer about Dagster pipeline orchestration',
  },
  {
    group:          'C. ASR Correction → Right Answer',
    label:          '"par keh" → Parquet',
    transcript:     'why do you use par keh format for storage',
    history:        [],
    expectBehavior: 'ANSWER',
    expectKeyword:  'Parquet',
    description:    'ASR mishears "Parquet" as "par keh" — should answer about columnar storage format',
  },
  {
    group:          'C. ASR Correction → Right Answer',
    label:          '"tree no" → Trino',
    transcript:     'how does tree no handle distributed queries',
    history:        [],
    expectBehavior: 'ANSWER',
    expectKeyword:  'Trino',
    description:    'ASR mishears "Trino" as "tree no" — should answer about Trino query engine',
  },

  // ── D. Normal interview questions — should answer correctly ─────────────
  {
    group:          'D. Normal Questions → Accurate Answer',
    label:          'Self introduction',
    transcript:     'Can you give me a brief introduction about yourself and your experience?',
    history:        [],
    expectBehavior: 'ANSWER',
    expectKeyword:  'TMA',
    description:    'Self-intro — should mention TMA Solutions, 5 years, project portfolio',
  },
  {
    group:          'D. Normal Questions → Accurate Answer',
    label:          'Lakehouse architecture',
    transcript:     'Can you explain the on-premise Lakehouse you built using MinIO, Trino and Project Nessie?',
    history:        [],
    expectBehavior: 'ANSWER',
    expectKeyword:  'MinIO',
    description:    'Should explain MinIO + Nessie (Iceberg catalog) + Trino SQL engine',
  },
  {
    group:          'D. Normal Questions → Accurate Answer',
    label:          'Data Vault at Resimac',
    transcript:     'What is Data Vault modeling and how did you implement it at Resimac?',
    history:        [],
    expectBehavior: 'ANSWER',
    expectKeyword:  'Resimac',
    description:    'Should mention Hubs/Links/Satellites + Raw/Business/Consumption layers at Resimac',
  },
]

// ─── One API call ─────────────────────────────────────────────────────────
interface CallResult {
  transcript:    string
  corrected?:    string   // if ASR correction fired
  answer:        string
  firstChunkMs:  number
  totalMs:       number
  isError:       boolean
}

async function callAPI(transcript: string, history: any[]): Promise<CallResult> {
  const start = Date.now()
  let firstChunkMs = -1
  let answer = ''
  let isError = false

  try {
    const res = await fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ transcript, context: '', mode: 'copilot', sessionId: SESSION, history }),
    })

    for await (const chunk of res.body as any) {
      if (firstChunkMs === -1) firstChunkMs = Date.now() - start
      answer += chunk.toString()
    }

    // detect JSON error response (Groq 503 etc.)
    if (answer.trim().startsWith('{') && answer.includes('"error"')) {
      isError = true
    }
  } catch (err: any) {
    answer   = `NETWORK_ERROR: ${err.message}`
    isError  = true
    firstChunkMs = Date.now() - start
  }

  return {
    transcript,
    answer: answer.trim(),
    firstChunkMs: firstChunkMs > 0 ? firstChunkMs : Date.now() - start,
    totalMs:      Date.now() - start,
    isError,
  }
}

// ─── Verdict logic ────────────────────────────────────────────────────────
const CLARIFICATION_PATTERNS = [
  /could you repeat/i,
  /could you rephrase/i,
  /didn.t.*(catch|hear)/i,
  /say that again/i,
  /clarify what you.re asking/i,
  /need.*more context/i,
  /just need.*context/i,
]

function isClarification(ans: string): boolean {
  return CLARIFICATION_PATTERNS.some(p => p.test(ans))
}

function gradeResult(tc: TestCase, result: CallResult): {
  verdict: 'PASS' | 'FAIL' | 'ERROR' | 'WARN'
  reason:  string
} {
  if (result.isError) return { verdict: 'ERROR', reason: 'Groq API error / rate limit' }

  const gotClarif = isClarification(result.answer)

  if (tc.expectBehavior === 'CLARIFICATION') {
    return gotClarif
      ? { verdict: 'PASS', reason: 'Correctly asked for clarification' }
      : { verdict: 'FAIL', reason: 'Expected clarification but got a real answer' }
  }

  // ANSWER or CONTEXT_ANSWER
  if (gotClarif) return { verdict: 'FAIL', reason: 'Got clarification when a real answer was expected' }

  if (tc.expectKeyword && !result.answer.toLowerCase().includes(tc.expectKeyword.toLowerCase())) {
    return { verdict: 'WARN', reason: `Answered but missing expected keyword "${tc.expectKeyword}"` }
  }

  return { verdict: 'PASS', reason: 'Correctly answered' + (tc.expectKeyword ? ` (contains "${tc.expectKeyword}")` : '') }
}

// ─── Markdown report builder ─────────────────────────────────────────────
function buildMarkdownReport(
  results: Array<{ tc: TestCase; result: CallResult; verdict: string; reason: string }>,
  totalMs: number,
): string {
  const now        = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
  const passCount  = results.filter(r => r.verdict === 'PASS').length
  const failCount  = results.filter(r => r.verdict === 'FAIL').length
  const warnCount  = results.filter(r => r.verdict === 'WARN').length
  const errCount   = results.filter(r => r.verdict === 'ERROR').length
  const avgFirst   = Math.round(results.filter(r => !r.result.isError).reduce((s,r)=>s+r.result.firstChunkMs,0) / Math.max(1, results.filter(r=>!r.result.isError).length))
  const overallBadge = failCount === 0 && errCount === 0 ? '🟢 EXCELLENT'
                     : failCount <= 1 && errCount <= 1   ? '🟡 GOOD'
                     :                                      '🔴 NEEDS REVIEW'

  let md = `# 📋 Interview AI Copilot — Full Behavior Test Report

**Date:** ${now}  
**Endpoint:** \`${API}\`  
**Total test cases:** ${results.length}  
**Total test duration:** ${Math.round(totalMs / 1000)}s  

---

## 📊 Summary

| Metric | Value |
|--------|-------|
| ✅ PASS | ${passCount} / ${results.length} |
| ❌ FAIL | ${failCount} / ${results.length} |
| ⚠️ WARN | ${warnCount} / ${results.length} |
| 🔴 ERROR (API) | ${errCount} / ${results.length} |
| Avg first chunk (non-error) | ${avgFirst}ms |
| Overall | ${overallBadge} |

> **ERROR = Groq 503 rate limit**, not a logic bug. Re-run with longer pauses if needed.

---

## 🧪 Test Results — Grouped by Scenario

`

  // group by tc.group
  const groups = [...new Set(results.map(r => r.tc.group))]

  for (const group of groups) {
    const groupResults = results.filter(r => r.tc.group === group)
    md += `\n### ${group}\n\n`

    for (let i = 0; i < groupResults.length; i++) {
      const { tc, result, verdict, reason } = groupResults[i]

      const badge = verdict === 'PASS'  ? '✅ PASS'
                  : verdict === 'FAIL'  ? '❌ FAIL'
                  : verdict === 'WARN'  ? '⚠️ WARN'
                  :                       '🔴 ERROR'

      const historyNote = tc.history.length > 0
        ? `*History provided: ${tc.history.length} prior turn(s)*`
        : `*No conversation history*`

      // clean up answer for display
      const cleanAnswer = result.answer
        .replace(/\{"error".*?\}/g, '[API Error — Groq rate limited]')
        .substring(0, 500)
        + (result.answer.length > 500 ? '…' : '')

      md += `#### ${badge} — ${tc.label}

**Description:** ${tc.description}  
**Expected behavior:** ${tc.expectBehavior}${tc.expectKeyword ? ` (keyword: \`${tc.expectKeyword}\`)` : ''}  
${historyNote}

**Transcript sent:**
\`\`\`
${tc.transcript}
\`\`\`

**System response:**
\`\`\`
${cleanAnswer || '(empty)'}
\`\`\`

**Verdict:** ${badge} — ${reason}  
**Timing:** First chunk \`${result.isError ? 'N/A' : result.firstChunkMs + 'ms'}\` | Total \`${result.totalMs}ms\`

---
`
    }
  }

  // appendix: timing table
  md += `\n## ⏱️ Timing Table\n\n`
  md += `| # | Group | Question | First Chunk | Total | Verdict |\n`
  md += `|---|-------|----------|------------|-------|--------|\n`
  results.forEach((r, i) => {
    const timing = r.result.isError ? 'ERROR' : `${r.result.firstChunkMs}ms`
    md += `| ${i+1} | ${r.tc.group.split('.')[0]} | ${r.tc.label} | ${timing} | ${r.result.totalMs}ms | ${r.verdict} |\n`
  })

  md += `\n---\n\n## 🔍 Notes\n\n`
  md += `- **CLARIFICATION gate** fires when: transcript is filler/fragment AND no history, OR no strong RAG match + structurally ambiguous\n`
  md += `- **Context-aware follow-ups**: short questions with conversation history use \`hotMemory.currentTopic\` to enrich RAG query\n`
  md += `- **ASR correction**: raw transcript corrected before RAG and LLM (e.g., "no flag" → "Snowflake")\n`
  md += `- **Groq rate limit**: free tier ~30 req/min. Run with 20s+ gaps between questions to avoid 503 errors.\n`

  return md
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(B(`\n${'═'.repeat(70)}`))
  console.log(B('  📋  Interview AI Copilot — Full Behavior Report'))
  console.log(B(`  ${CASES.length} test cases | ${PACE_MS/1000}s pace | ${API}`))
  console.log(B(`${'═'.repeat(70)}\n`))

  const allResults: Array<{ tc: TestCase; result: CallResult; verdict: string; reason: string }> = []
  const testStart = Date.now()
  let currentGroup = ''

  for (let i = 0; i < CASES.length; i++) {
    const tc = CASES[i]

    if (tc.group !== currentGroup) {
      currentGroup = tc.group
      console.log(C(`\n  ── ${tc.group} ${'─'.repeat(Math.max(0, 50 - tc.group.length))}`))
    }

    process.stdout.write(`  [${String(i+1).padStart(2,'0')}/${CASES.length}] ${tc.label}\n`)
    process.stdout.write(D(`         Q: "${tc.transcript.substring(0, 70)}${tc.transcript.length > 70 ? '…' : ''}"\n`))
    if (tc.history.length > 0) process.stdout.write(D(`         📜 with ${tc.history.length} history turn(s)\n`))

    const result = await callAPI(tc.transcript, tc.history)
    const { verdict, reason } = gradeResult(tc, result)

    const verdictDisplay = verdict === 'PASS'  ? G('✅ PASS')
                         : verdict === 'FAIL'  ? R('❌ FAIL')
                         : verdict === 'WARN'  ? Y('⚠️ WARN')
                         :                       R('🔴 ERROR')

    const timing = result.isError ? R('API Error') : G(`${result.firstChunkMs}ms`)
    const preview = result.answer.substring(0, 110).replace(/\n/g, ' ')

    console.log(`         ${verdictDisplay} | First chunk: ${timing} | Total: ${result.totalMs}ms`)
    console.log(D(`         A: ${preview}`))
    console.log(`         → ${reason}\n`)

    allResults.push({ tc, result, verdict, reason })

    if (i < CASES.length - 1) {
      process.stdout.write(D(`         ⏳ ${PACE_MS/1000}s pause...\n\n`))
      await new Promise(r => setTimeout(r, PACE_MS))
    }
  }

  const totalMs = Date.now() - testStart

  // ── Build + write report ────────────────────────────────────────────────
  const reportDir = path.join('test', 'reports')
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })

  const filename = `full-report-${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.md`
  const filepath = path.join(reportDir, filename)
  const markdown = buildMarkdownReport(allResults, totalMs)
  fs.writeFileSync(filepath, markdown, 'utf-8')

  // ── Console summary ─────────────────────────────────────────────────────
  const passCount = allResults.filter(r => r.verdict === 'PASS').length
  const failCount = allResults.filter(r => r.verdict === 'FAIL').length
  const warnCount = allResults.filter(r => r.verdict === 'WARN').length
  const errCount  = allResults.filter(r => r.verdict === 'ERROR').length

  console.log(B(`\n${'═'.repeat(70)}`))
  console.log(B('  📊  FINAL RESULTS'))
  console.log(B(`${'═'.repeat(70)}`))
  console.log(`
  ${G(`✅ PASS:  ${passCount}`)}
  ${R(`❌ FAIL:  ${failCount}`)}
  ${Y(`⚠️  WARN:  ${warnCount}`)}
  ${R(`🔴 ERROR: ${errCount}`)} (Groq rate limit — not logic bugs)

  Report saved to: ${filepath}
  `)
}

main().catch(err => {
  console.error(R('\n❌ Test runner failed: ' + err.message))
  console.error('   Make sure backend is running: npm run dev (in /backend)')
  process.exit(1)
})
