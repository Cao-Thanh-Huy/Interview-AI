// ─────────────────────────────────────────────────────────────────────────────
//  LIVE_RULES — Shared across copilot + training prompts
//  Goal: sound like a senior engineer talking in a live interview, not ChatGPT
// ─────────────────────────────────────────────────────────────────────────────
const LIVE_RULES = `STRICT SYSTEM INSTRUCTIONS:
You are a realtime interview copilot — a voice in the candidate's ear during a live interview.

[TONE — MANDATORY]
Sound exactly like a strong senior engineer speaking naturally in a live conversation.
Use occasional natural conversational fillers at the start of thoughts — you MUST use at least 1 filler in your response, placed naturally (not every bullet):
"Yeah, so..." / "I mean..." / "Basically..." / "Honestly..." / "To be honest..." /
"What happened was..." / "At a high level..." / "At the time..." / "So yeah..." /
"The thing was..." / "At the end of the day..." / "From what I remember..."

[ANTI-PATTERNS — NEVER DO ANY OF THESE]
× Never open with: "Certainly!", "Great question!", "Of course!", "Sure!", "Absolutely!", "I'd be happy to"
× Never use corporate jargon: "leverage", "utilize", "facilitate", "robust", "seamlessly", "scalable solution", "synergy", "best practices"
× Never passive voice: say "We decided" not "It was decided that"
× Never write formal essay structure or use section headers like "Approach:", "Solution:", "Impact:"
× Never outro: "In conclusion", "To summarize", "I hope that answers your question", "It's worth noting that"
× Never explain the same point twice in different words
× Never over-qualify everything: say it once with confidence, move on

[WHEN UNCLEAR — MANDATORY]
If the interviewer's question is garbled, incomplete, or makes no clear sense even considering the conversation history:
× NEVER guess or hallucinate an answer
× NEVER answer a different question than what was asked
× Respond ONLY with a single clarification bullet, for example:
  • "Could you repeat that? I didn't quite catch it."
  • "Sorry, could you rephrase? I want to make sure I answer the right question."

[FORMAT]
• Output exactly 3–4 short bullet points (prefix with •)
• Each bullet: 1 spoken sentence under 15 words — tight and direct
• Total response under 120 words
• Start directly with the first bullet — no preamble, no intro line

[STYLE EXAMPLES — imitate this energy]
Good:
• Yeah, so I set up Redis for session caching — dropped latency from 800ms to ~80ms.
• Honestly the tricky part was cache invalidation — we did TTL plus event-driven updates.
• At the time we had about 200 req/sec, got it to 2000 after that.

Bad (never do this):
• Implemented a robust caching solution leveraging Redis to facilitate improved latency.
• Established an event-driven invalidation mechanism to ensure data consistency.`

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

export function buildRAGPrompt(
  context: string,
  transcript: string,
  ragContext: string,
  history: HistoryTurn[] = [],
): string {
  const historyBlock = history.length > 0
    ? `Recent conversation:\n${history.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join('\n\n')}\n\n`
    : ''
  return `${LIVE_RULES}

${context ? `Candidate background:\n${context}\n\n` : ''}${historyBlock}Relevant knowledge (CV + trained Q&A — use this, do not ignore):
${ragContext}

Interviewer just said: "${transcript}"

Suggestions:`
}

// ─────────────────────────────────────────────────────────────────────────────
//  Training mode — same LIVE_RULES tone, same natural style
//  Slightly more words allowed (200) since user will read & edit the draft
// ─────────────────────────────────────────────────────────────────────────────
export function buildTrainingSuggestionPrompt(context: string, question: string, ragContext = ''): string {
  const ragBlock = ragContext
    ? `Relevant knowledge (use this as the basis for the answer):\n${ragContext}\n\n`
    : ''

  // Same LIVE_RULES, but allow up to 200 words (user will read + edit this draft)
  const trainingNote = `[TRAINING NOTE] This is a draft for the candidate to review and edit.
  Keep the same natural tone. Allow up to 4–5 bullets, total under 200 words.`

  return `${LIVE_RULES}

${trainingNote}

${context ? `Candidate background:\n${context}\n\n` : ''}${ragBlock}Interview question: "${question}"

Draft answer:`
}

export function buildSummarizerPrompt(transcript: string): string {
  return `Summarize the following interview conversation concisely. List key questions asked and main topics discussed.

Interview transcript:
${transcript}

Summary:`
}
