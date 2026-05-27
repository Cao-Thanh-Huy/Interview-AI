export interface Turn {
  id: string
  question: string
  questionTranslation?: string
  timestamp: string
  answer: string
  answerTranslation?: string
  isGenerating: boolean
}

export type DeepgramStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type AudioSource = 'system' | 'microphone' | null

export type AppPhase = 'setup' | 'interview'

export type CompletionMode = 'copilot' | 'summarizer' | 'training'

export interface HistoryTurn {
  question: string
  answer: string
}

export interface SessionMetadata {
  sessionId: string
  startedAt: string
  context: string
}

export interface TurnEntry {
  id: string
  question: string
  answer: string
  timestamp: string
}

export interface SessionDetail {
  meta: SessionMetadata
  turns: TurnEntry[]
}

export type UpsertQAResult =
  | { status: 'inserted'; aliases_saved: number }
  | { status: 'updated'; aliases_saved: number }
  | { status: 'blocked_duplicate' }
  | { status: 'blocked_injection' }

// --- Alias suggestion types ---

/** Nearest neighbor từ KB — dùng cho retrieval impact warning trong UI */
export interface AliasImpact {
  phrase: string       // phrase trong KB gần nhất
  score: number        // cosine similarity (0–1)
  unitQuestion: string // display question của unit đó
}

/** Một alias được suggest kèm retrieval impact info */
export interface SuggestedAlias {
  phrase: string
  impact: AliasImpact[]  // top 2 nearest từ OTHER units
}

export interface SuggestAliasesResult {
  aliases: SuggestedAlias[]
}
