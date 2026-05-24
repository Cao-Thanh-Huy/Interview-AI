export interface Turn {
  id: string
  question: string
  timestamp: string
  answer: string
  isGenerating: boolean
}

export type DeepgramStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type AudioSource = 'system' | 'microphone' | null

export type AppPhase = 'setup' | 'interview'

export type CompletionMode = 'copilot' | 'summarizer'
