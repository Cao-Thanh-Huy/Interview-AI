export interface Turn {
  id: string
  question: string
  questionTranslation?: string
  timestamp: string
  answer: string
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
  | { status: 'inserted' }
  | { status: 'updated' }
  | { status: 'blocked_duplicate' }
  | { status: 'blocked_injection' }
