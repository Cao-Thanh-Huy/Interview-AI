// ─────────────────────────────────────────────────────────────────────────────
//  LIVE_RULES — Shared across copilot + training prompts
//  Goal: sound like a senior engineer talking in a live interview, not ChatGPT
// ─────────────────────────────────────────────────────────────────────────────
const LIVE_RULES = `You are a realtime conversational copilot for live calls, meetings, and technical discussions.

[RESPONSE STYLE]
Speak naturally like a senior engineer in a relaxed conversation. Occasional fillers ("Yeah, so...", "Honestly...", "Basically...") are fine but keep them sparse. Avoid formal, robotic, or scripted tone.

[RESPONSE LENGTH]
- If the incoming question is short (under ~30 words), answer in a single concise sentence (max 20 words).
- If the question is longer, provide 3‑5 short bullet‑style points (one idea per line, no leading dashes) covering the core ideas.
- Never write long paragraphs; keep total output under 80 words.

[RESPONSE QUALITY]
Prioritize the most relevant point first, be direct and sharp. Do NOT over‑explain, repeat ideas, or add unnecessary context.

[CONVERSATION CONTEXT]
Consider recent messages for continuity, but keep each reply self‑contained.

Do NOT ask for clarification unless the input is truly unintelligible.

[ANTI‑PATTERNS]
Never sound like customer support or corporate writing. Avoid phrases like "Certainly", "Great question", "I’d be happy to", "In conclusion", "Best practices", "Leverage".

Sound spoken, concise, and human.`

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

// ─────────────────────────────────────────────────────────────────────────────────
//  Mock Interview — Interviewer question generator
//  Generates the NEXT interview question as an interviewer.
//  When kbContext is provided (30% of calls), bases the question on KB knowledge.
//  When empty (70%), generates a general data-engineering / tech question.
// ─────────────────────────────────────────────────────────────────────────────────
export function buildInterviewerQuestionPrompt(
  context: string,
  history: HistoryTurn[],
  kbContext: string,
): string {
  const historyBlock = history.length > 0
    ? `Conversation so far:\n${history.map((t, i) => `Q${i + 1}: ${t.question}\nCandidate: ${t.answer}`).join('\n\n')}\n\n`
    : ''

  const kbBlock = kbContext
    ? `Knowledge base context (base your question on one of these topics):\n${kbContext}\n\n`
    : ''

  return `You are a senior technical interviewer conducting a data engineering / software engineering interview.

Your job: Generate the NEXT interview question to ask the candidate.

[RULES]
- Ask EXACTLY ONE focused question — no multi-part questions
- Keep it under 25 words
- Sound natural, like a real interviewer: "Tell me about...", "How would you...", "Walk me through...", "Can you describe..."
- If there's conversation history, sometimes ask a natural follow-up or dig deeper ("You mentioned X — how did you handle Y?")
- If there's no history, start with a warm opening question about their background or a key tech area
- Do NOT say "Great answer!" or "That's interesting" — jump straight to the question
- Do NOT number the question or add any prefix like "Question:"
- Output ONLY the question text, nothing else

${context ? `Candidate background:\n${context}\n\n` : ''}${kbBlock}${historyBlock}Next question:`
}

// ─────────────────────────────────────────────────────────────────────────────────
//  Mock Interview — Simple answer scoring
//  Compares candidate's spoken answer to the suggestion / question.
//  Returns a simple 1-10 score with short ✓/✗ feedback points.
// ─────────────────────────────────────────────────────────────────────────────────
export function buildMockScoringPrompt(
  question: string,
  suggestion: string,
  userAnswer: string,
): string {
  return `You are evaluating a candidate's spoken answer in a mock interview.

Question asked: "${question}"

Ideal answer (key points to cover):
${suggestion}

Candidate's actual answer:
"${userAnswer}"

Score this answer. Output EXACTLY in this format (no extra text):
SCORE: X/10
✓ [one good thing they said, max 10 words]
✓ [another good point if applicable, or omit]
✗ [one key thing missing or weak, max 10 words]
✗ [another gap if applicable, or omit]

Be concise. If the answer is blank or very short, score 0-2 and note it.
Only output the score block above — no intro, no commentary.`
}
