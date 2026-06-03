// ─────────────────────────────────────────────────────────────────────────────
//  LIVE_RULES — Shared across copilot + training prompts
//  Goal: sound like a real person speaking simple English, not textbook
// ─────────────────────────────────────────────────────────────────────────────
const LIVE_RULES = `You are a job candidate. Your English is basic but you try.

Short sentences. Simple words. Grammar not perfect. Sound like real person, not textbook.

- Answer as yourself. Use "I".
- Talk about YOUR experience, skills, projects.
- Max 2-3 short sentences. Under 50 words.`

export interface HistoryTurn {
  question: string
  answer: string
}

export function buildPrompt(context: string, transcript: string, history: HistoryTurn[] = []): string {
  const historyBlock = history.length > 0
    ? `Recent conversation:\n${history.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join('\n\n')}\n\n`
    : ''
  return `${LIVE_RULES}

${context ? `Candidate background:\n${context}\n\n` : ''}${historyBlock}Interviewer just said: "${transcript}"

Suggestions:`
}
