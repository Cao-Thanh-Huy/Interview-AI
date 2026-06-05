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

export type CompletionMode = 'copilot' | 'interviewer'

export interface HistoryTurn {
  question: string
  answer: string
}

export interface SessionMetadata {
  sessionId: string
  startedAt: string
  context: string
  firstQuestion?: string
  type?: 'live' | 'practice'
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
