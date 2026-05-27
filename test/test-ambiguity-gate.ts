/**
 * test-ambiguity-gate.ts
 * Tests: ambiguity gate, enriched retrieval, clarification responses
 * Run: npx tsx test/test-ambiguity-gate.ts
 * Requires: backend running at http://127.0.0.1:3001
 */
import fetch from 'node-fetch'

const API = 'http://127.0.0.1:3001/api/completion'
const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`
const CYAN   = (s: string) => `\x1b[36m${s}\x1b[0m`
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`
const DIM    = (s: string) => `\x1b[2m${s}\x1b[0m`

async function ask(transcript: string, history: any[] = [], sessionId = 'gate-test') {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, context: '', mode: 'copilot', sessionId, history }),
  })
  let text = ''
  for await (const chunk of res.body as any) text += chunk.toString()
  return text.trim()
}

const FAKE_SNOWFLAKE_HISTORY = [
  {
    question: 'Can you tell me how Snowflake works?',
    answer: '• Yeah, so Snowflake separates compute from storage — you pay for each independently.\n• Queries run on virtual warehouses that spin up in seconds.\n• Data is stored in columnar format on S3, so no local disk.',
  },
]

interface TestCase {
  label: string
  transcript: string
  history?: any[]
  expectClarification: boolean   // true = expect "could you repeat" style response
  expectKeyword?: string          // optional: substring that must appear in real answers
}

const CASES: TestCase[] = [
  // ── Gate: should ask for clarification ─────────────────────────────────────
  {
    label: 'Garbled: "do you experience seasonal fluctuation"',
    transcript: 'do you experience seasonal fluctuation',
    history: [],
    expectClarification: true,
  },
  {
    label: 'Fragment: "alright do you"',
    transcript: 'alright do you',
    history: [],
    expectClarification: true,
  },
  {
    label: 'Too short: "and also"',
    transcript: 'and also',
    history: [],
    expectClarification: true,
  },

  // ── Gate: should NOT flag (has history or has keywords) ──────────────────
  {
    label: 'Follow-up with history: "what about Athena?"',
    transcript: 'what about Athena?',
    history: FAKE_SNOWFLAKE_HISTORY,
    expectClarification: false,
    expectKeyword: 'Athena',
  },
  {
    label: 'Vague follow-up with history: "and the other one?"',
    transcript: 'and the other one?',
    history: FAKE_SNOWFLAKE_HISTORY,
    expectClarification: false,
  },

  // ── ASR correction + gate + retrieval ───────────────────────────────────
  {
    label: 'ASR mishear: "how to work on the no flag" → Snowflake',
    transcript: 'how to work on the no flag',
    history: [],
    expectClarification: false,
    expectKeyword: 'Snowflake',
  },
  {
    label: 'ASR mishear: "tell me about dag star orchestration"',
    transcript: 'tell me about dag star orchestration',
    history: [],
    expectClarification: false,
    expectKeyword: 'Dagster',
  },

  // ── Normal coherent questions (must answer) ──────────────────────────────
  {
    label: 'Normal: "How does Snowflake separate compute from storage?"',
    transcript: 'How does Snowflake separate compute from storage?',
    history: [],
    expectClarification: false,
    expectKeyword: 'Snowflake',
  },
  {
    label: 'Normal: "What is your experience with Apache Spark?"',
    transcript: 'What is your experience with Apache Spark?',
    history: [],
    expectClarification: false,
    expectKeyword: 'Spark',
  },
]

const CLARIFICATION_PATTERNS = [
  /could you repeat/i,
  /could you rephrase/i,
  /didn.t quite catch/i,
  /didn.t catch/i,
  /say that again/i,
  /clarify what you.re asking/i,
]

function isClarification(response: string): boolean {
  return CLARIFICATION_PATTERNS.some(p => p.test(response))
}

async function main() {
  console.log(BOLD(`\n${'═'.repeat(70)}`))
  console.log(BOLD('  🧪  Ambiguity Gate + Enriched Retrieval — Integration Test'))
  console.log(BOLD(`${'═'.repeat(70)}\n`))

  let pass = 0; let fail = 0

  for (let i = 0; i < CASES.length; i++) {
    const tc = CASES[i]
    process.stdout.write(`  [${String(i + 1).padStart(2, '0')}/${CASES.length}] ${tc.label}\n`)

    let response = ''
    try {
      response = await ask(tc.transcript, tc.history ?? [])
    } catch (err: any) {
      console.log(`       ${RED('ERROR')}: ${err.message}\n`)
      fail++
      continue
    }

    const gotClarification = isClarification(response)
    const preview = response.substring(0, 100).replace(/\n/g, ' ')

    let ok = true

    if (tc.expectClarification && !gotClarification) {
      console.log(`       ${RED('FAIL')} — expected clarification but got real answer`)
      console.log(`       ${DIM('Got: ' + preview)}`)
      ok = false
    } else if (!tc.expectClarification && gotClarification) {
      console.log(`       ${RED('FAIL')} — got clarification when a real answer was expected`)
      console.log(`       ${DIM('Got: ' + preview)}`)
      ok = false
    } else if (tc.expectKeyword && !response.toLowerCase().includes(tc.expectKeyword.toLowerCase())) {
      console.log(`       ${YELLOW('WARN')} — answered but missing expected keyword "${tc.expectKeyword}"`)
      console.log(`       ${DIM('Got: ' + preview)}`)
      ok = false
    }

    if (ok) {
      const label = tc.expectClarification ? 'Correctly asked for clarification' : 'Correctly answered'
      console.log(`       ${GREEN('PASS')} — ${label}`)
      console.log(`       ${DIM(preview)}`)
      pass++
    } else {
      fail++
    }

    // 18s pause between questions to respect Groq rate limits
    if (i < CASES.length - 1) {
      process.stdout.write(DIM('       ⏳ 18s pause...\n'))
      await new Promise(r => setTimeout(r, 18000))
    }
    console.log()
  }

  console.log(BOLD(`${'═'.repeat(70)}`))
  const overall = fail === 0 ? GREEN('🟢 ALL PASS') : fail <= 2 ? YELLOW(`🟡 ${pass}/${CASES.length} PASS`) : RED(`🔴 ${pass}/${CASES.length} PASS`)
  console.log(BOLD(`  Result: ${overall}  (${pass} passed, ${fail} failed)\n`))
}

main().catch(err => {
  console.error(RED('\n❌ Test failed: ' + err.message))
  console.error('   Make sure backend is running: npm run dev (in /backend)')
  process.exit(1)
})
