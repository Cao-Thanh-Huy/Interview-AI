/**
 * Filler words to ignore in transcripts (English + Vietnamese)
 */
const FILLER_SET = new Set([
  // English
  'uh', 'um', 'ah', 'er', 'hmm', 'hm', 'oh', 'like', 'so', 'well',
  'yeah', 'yep', 'ok', 'okay', 'right', 'sure', 'alright',
  // Vietnamese
  'à', 'ừ', 'ờ', 'ơ', 'ừm', 'ừh', 'thì', 'là', 'dạ', 'vâng',
  'ý', 'kiểu', 'và', 'cũng', 'thế', 'mà', 'nhỉ', 'nhé', 'đó', 'thôi',
])

/**
 * Returns true if the transcript is too short or made almost entirely of filler words.
 * These should skip RAG and use a default/minimal prompt instead.
 */
export function isFillerTranscript(transcript: string): boolean {
  const trimmed = transcript.trim()
  if (trimmed.length < 15) return true

  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true

  const fillerCount = words.filter((w) => FILLER_SET.has(w)).length
  if (fillerCount / words.length > 0.65) return true

  // ── Dangling fragment detection ───────────────────────────────────────────
  // Catch ASR cut-off mid-sentence: starts with a question/auxiliary verb
  // but has ≤2 words total (no object/predicate).
  // Examples: "Do you", "Have you", "Can you", "Are you", "Tell me", "What's your"
  const DANGLING_STARTERS = new Set([
    'do', 'did', 'does', 'have', 'has', 'had',
    'can', 'could', 'will', 'would', 'should', 'shall',
    'are', 'is', 'was', 'were',
    'tell', 'show', 'give', 'walk',
  ])
  if (words.length <= 2 && DANGLING_STARTERS.has(words[0])) return true

  return false
}

const FILLER_REGEX = /\b(uh|um|ah|er|hmm?|oh|like|so|well|yeah|yep|ok|okay|right|sure|alright|à|ừm?|ờ|ơ|thì|là|dạ|vâng|ý|kiểu|và|cũng|thế|mà|nhỉ|nhé|đó|thôi)\b/gi

/**
 * Strips filler words and normalises the transcript to a clean semantic query.
 */
export function buildRetrievalQuery(transcript: string): string {
  return transcript
    .replace(FILLER_REGEX, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .toLowerCase()
}

// ─────────────────────────────────────────────────────────────────────────────
//  Ambiguity detection — determines if a transcript is too garbled/short to
//  answer meaningfully without more context.
// ─────────────────────────────────────────────────────────────────────────────

const QUESTION_WORDS = new Set([
  'how', 'what', 'why', 'when', 'where', 'who', 'which', 'can', 'could',
  'do', 'did', 'does', 'is', 'are', 'was', 'were', 'will', 'would',
  'tell', 'explain', 'describe', 'walk', 'show', 'give', 'talk',
])

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'about', 'into', 'through', 'during',
  'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'this', 'that',
  'uh', 'um', 'ah', 'er', 'hmm', 'hm', 'oh', 'so', 'yeah', 'okay', 'right',
])

/**
 * Returns true if the transcript is ambiguous and should trigger a
 * clarification response instead of an LLM answer attempt.
 *
 * Logic:
 *   - If hasHistory=true (follow-up question exists) → only flag if transcript
 *     is extremely short (< 3 chars) or a pure filler. Short follow-ups like
 *     "what about Athena?" are valid in context.
 *   - If hasHistory=false (first question) → flag if:
 *       • Fewer than 4 meaningful (non-stop, non-filler) words, AND
 *       • No question word present
 */
export function isAmbiguousTranscript(
  transcript: string,
  hasHistory: boolean,
): boolean {
  const trimmed = transcript.trim()

  // Always flag empty / extremely short strings
  if (trimmed.length < 6) return true

  const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean)

  // If conversation history exists, be lenient — it's likely a follow-up
  if (hasHistory) {
    // Only reject if it's purely filler or nonsense
    const meaningfulWords = words.filter(w => !STOP_WORDS.has(w) && !FILLER_SET.has(w))
    return meaningfulWords.length === 0
  }

  // No history — stricter check, but still lenient enough for coherent statements
  const hasQuestionWord = words.some(w => QUESTION_WORDS.has(w))
  const meaningfulWords = words.filter(w => !STOP_WORDS.has(w) && !FILLER_SET.has(w))

  // Flag ONLY if truly empty/noise — 2+ meaningful words = coherent enough to attempt
  return meaningfulWords.length < 2 && !hasQuestionWord
}

// Clarification responses — rotated randomly for natural feel
const CLARIFICATION_RESPONSES = [
  '• Could you repeat that? I didn\'t quite catch it.',
  '• Sorry, could you rephrase the question? I want to make sure I answer the right thing.',
  '• I\'m not sure I heard that correctly — could you say that again?',
  '• Could you clarify what you\'re asking? I want to give you a precise answer.',
  '• I didn\'t catch that fully — could you repeat or rephrase?',
]

let _clarIdx = 0

/** Returns a clarification response, rotating through the pool. */
export function getClarificationResponse(): string {
  const resp = CLARIFICATION_RESPONSES[_clarIdx % CLARIFICATION_RESPONSES.length]
  _clarIdx++
  return resp
}

/**
 * Builds an enriched retrieval query for short/vague follow-up questions.
 * Prepends the current conversation topic so RAG can find relevant context
 * even when the transcript itself has no keywords.
 *
 * Example:
 *   currentTopic = "how does Snowflake work"
 *   transcript   = "what about Athena?"
 *   → enriched   = "snowflake athena"
 */
export function buildEnrichedRetrievalQuery(
  transcript: string,
  currentTopic: string | null,
): string {
  const base = buildRetrievalQuery(transcript)

  if (!currentTopic) return base

  const words = transcript.trim().split(/\s+/).filter(Boolean)

  // ── Explicit follow-up detection ──────────────────────────────────────────
  // Only enrich when the sentence is a genuine short follow-up.
  // Criteria: ≤3 words AND starts with a follow-up connector word.
  // This prevents topic pollution when the question is self-contained
  // (e.g., "Do you know Cortex AI?" or "Now I'm in package five" should NOT
  //  be enriched with a stale "Snowflake" topic from the previous turn).
  const FOLLOW_UP_STARTERS = new Set([
    'what', 'how', 'why', 'and', 'also', 'but', 'then', 'so',
    'tell', 'explain', 'give', 'show',
  ])

  const firstWord = words[0]?.toLowerCase() ?? ''
  const isShortFollowUp = words.length <= 3 && FOLLOW_UP_STARTERS.has(firstWord)

  if (isShortFollowUp) {
    // Prepend topic keywords (strip stop words from topic first)
    const topicKeywords = buildRetrievalQuery(currentTopic)
    return `${topicKeywords} ${base}`.trim()
  }

  return base
}

/**
 * Prompt injection patterns to detect and neutralise.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|prior|all)\s+(instructions?|prompts?|context|rules?)/gi,
  /ignore\s+system\s+prompt/gi,
  /act\s+as\s+/gi,
  /jailbreak/gi,
  /you\s+are\s+now\s+a/gi,
  /pretend\s+(you\s+are|to\s+be)/gi,
  /system\s+prompt\s*:/gi,
  /\[INST\]/g,
  /<\|system\|>/g,
  /\{\{.*?\}\}/g,         // template injection
  /\$\{.*?\}/g,           // JS template literal injection
  /--\s*system/gi,        // common injection separator
]

/**
 * Returns true if the input contains known injection patterns.
 */
export function hasInjectionAttempt(input: string): boolean {
  return INJECTION_PATTERNS.some((p) => {
    p.lastIndex = 0
    return p.test(input)
  })
}

/**
 * Replaces injection patterns with [filtered] to neutralise attacks.
 */
export function sanitizeInput(input: string): string {
  let result = input
  for (const pattern of INJECTION_PATTERNS) {
    pattern.lastIndex = 0
    result = result.replace(pattern, '[filtered]')
  }
  // Strip null bytes and control characters
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return result.trim()
}
