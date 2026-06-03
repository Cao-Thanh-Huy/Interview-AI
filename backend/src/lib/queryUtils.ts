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
  /\{\{.*?\}\}/g,
  /\$\{.*?\}/g,
  /--\s*system/gi,
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
  result = result.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
  return result.trim()
}
