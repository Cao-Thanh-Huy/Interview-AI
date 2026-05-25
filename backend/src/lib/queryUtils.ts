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
  return fillerCount / words.length > 0.65
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
