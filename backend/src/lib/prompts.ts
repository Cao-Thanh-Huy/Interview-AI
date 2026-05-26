const LIVE_RULES = `STRICT SYSTEM INSTRUCTIONS:
- You are a realtime interview copilot.
- Answer like a strong senior engineer speaking naturally in a live interview.
- Concise but insightful: Explain trade-offs, solutions, or actions directly.
- Practical over theoretical: Focus on real-world engineering actions and numbers rather than academic definitions.
- Conversational, not academic: Use short spoken-style sentences. Avoid sounding like ChatGPT.
- Avoid generic filler, intro sentences, or outro sentences. Start directly with the first suggestion.
- Lead with the key insight first. Explain tradeoffs when relevant.
- Structure: Output ONLY 3-4 short bullet points (prefix with •).
- Keep each bullet extremely short (under 15 words). Total response must be under 120 words.
- Prioritize confidence, clarity, and match the depth of the question.
- Use the candidate's background and saved knowledge whenever relevant.`

export interface HistoryTurn {
  question: string
  answer: string
}

export function buildPrompt(context: string, transcript: string, history: HistoryTurn[] = []): string {
  const historyBlock = history.length > 0
    ? `Recent conversation history:\n${history.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join('\n\n')}\n\n`
    : ''
  return `${LIVE_RULES}

${context ? `Candidate Background & Context:\n${context}\n\n` : ''}${historyBlock}
Interviewer just asked: "${transcript}"

Suggestions (direct, spoken bullet points):`
}

export function buildRAGPrompt(
  context: string,
  transcript: string,
  ragContext: string,
  history: HistoryTurn[] = [],
): string {
  const historyBlock = history.length > 0
    ? `Recent conversation history:\n${history.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join('\n\n')}\n\n`
    : ''
  return `${LIVE_RULES}

${context ? `Candidate Background & Context:\n${context}\n\n` : ''}${historyBlock}Relevant Knowledge Base (CV + Trained Q&A):
${ragContext}

Interviewer just asked: "${transcript}"

Suggestions (direct, spoken bullet points):`
}

export function buildTrainingSuggestionPrompt(context: string, question: string, ragContext = ''): string {
  const historyBlock = '' // Luyện tập độc lập nên không có lịch sử hội thoại trước đó
  const ragBlock = ragContext
    ? `Relevant Knowledge Base (CV + Trained Q&A):\n${ragContext}\n\n`
    : ''
  
  return `${LIVE_RULES}

${context ? `Candidate Background & Context:\n${context}\n\n` : ''}${historyBlock}${ragBlock}Interviewer just asked: "${question}"

Suggestions (direct, spoken bullet points):`
}

export function buildSummarizerPrompt(transcript: string): string {
  return `Summarize the following interview conversation. List the key questions asked and the main topics discussed. Keep it concise.

Interview transcript:
${transcript}

Summary:`
}

