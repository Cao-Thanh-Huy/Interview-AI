export function buildPrompt(context: string, transcript: string): string {
  return `You are an interview assistant AI helping a job candidate in a live interview.
${context ? `Interview context: ${context}\n` : ''}
The INTERVIEWER just said:
"${transcript}"

Answer the specific question directly and concisely. For factual or simple questions (e.g. name, location, availability), give one short sentence. For behavioral or experience questions, use 2-3 focused bullet points. Do not pad with generic advice. English only.`
}

export function buildRAGPrompt(context: string, transcript: string, cvContext: string): string {
  return `You are an interview assistant AI helping a job candidate in a live interview.
${context ? `Interview context: ${context}\n` : ''}
Candidate's CV/Resume:
${cvContext}

The INTERVIEWER just asked:
"${transcript}"

Answer the specific question directly using only the most relevant CV details. For factual questions, one short sentence. For experience/behavioral questions, 2-3 bullet points with specific CV details. Do not list unrelated experience. English only.`
}

export function buildSummarizerPrompt(transcript: string): string {
  return `Summarize the following interview conversation. List the key questions asked and the main topics discussed. Keep it concise.

Interview transcript:
${transcript}

Summary:`
}
