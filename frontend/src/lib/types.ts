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

export type CompletionMode = 'copilot' | 'training' | 'interviewer'

export interface HistoryTurn {
  question: string
  answer: string
}

export interface SessionMetadata {
  sessionId: string
  startedAt: string
  context: string
  firstQuestion?: string
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

// ── Mock Interview types ─────────────────────────────────────────────────────────────────

export type MockTurnPhase =
  | 'asking'       // AI is generating the question (streaming)
  | 'suggesting'   // AI is generating the suggestion hint (streaming, parallel with TTS)
  | 'listening'    // Waiting for user to speak
  | 'recording'    // Deepgram is capturing user's answer
  | 'scoring'      // AI is scoring the answer (streaming)
  | 'done'         // Turn complete, ready for next question

export interface MockTurn {
  id: string
  index: number               // Question number (1-based)
  question: string            // AI interviewer question
  suggestion: string          // AI model answer hint (shown before user answers)
  isSuggestionStreaming: boolean
  userTranscript: string      // Live transcript while recording
  userAnswer: string          // Finalized user answer
  score: string               // AI scoring result
  isScoringStreaming: boolean
  phase: MockTurnPhase
}
