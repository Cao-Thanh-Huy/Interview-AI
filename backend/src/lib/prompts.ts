const LIVE_RULES = `RULES (STRICT):
- Output ONLY 3-5 bullet points (• prefix). No intro sentence. No outro.
- Each bullet: MAX 15 words.
- Use STAR keywords: Situation/Task/Action/Result.
- Prefer concrete keywords and numbers over vague phrases.
- If a simple factual question: ONE bullet only (name, date, location, etc.).
- No prose, no paragraphs, no filler words.`

export interface HistoryTurn {
  question: string
  answer: string
}

export function buildPrompt(context: string, transcript: string, history: HistoryTurn[] = []): string {
  const historyBlock = history.length > 0
    ? `Recent conversation:\n${history.map((t) => `Q: ${t.question}\nA: ${t.answer}`).join('\n\n')}\n\n`
    : ''
  return `You are a live interview copilot giving a candidate real-time bullet-point suggestions.
${context ? `Session context: ${context}\n` : ''}${historyBlock}${LIVE_RULES}

Interviewer just asked: "${transcript}"

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
  return `You are a live interview copilot giving a candidate real-time bullet-point suggestions.
${context ? `Session context: ${context}\n` : ''}${historyBlock}Knowledge base (CV + trained QA):
${ragContext}

${LIVE_RULES}

Interviewer just asked: "${transcript}"

Suggestions:`
}

export function buildTrainingSuggestionPrompt(context: string, question: string, ragContext = ''): string {
  const knowledgeBlock = ragContext
    ? `\nRelevant knowledge from your profile:\n${ragContext}\n\nUse the above as the foundation for your answer. Personalize and expand as needed.\n`
    : ''
  return `You are a professional interview coach. Draft a strong, concise answer for the following interview question.
${context ? `Role/Context: ${context}\n` : ''}${knowledgeBlock}
Question: "${question}"

Write a structured answer using the STAR method. Use 4-5 bullet points. Each bullet ≤ 20 words. Be specific and impactful.`
}

export function buildSummarizerPrompt(transcript: string): string {
  return `Summarize the following interview conversation. List the key questions asked and the main topics discussed. Keep it concise.

Interview transcript:
${transcript}

Summary:`
}
