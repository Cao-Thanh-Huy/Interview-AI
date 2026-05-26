import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Turn, AppPhase } from '@/lib/types'

interface InterviewStore {
  // Phase
  phase: AppPhase
  setPhase: (phase: AppPhase) => void

  // Setup
  context: string
  setContext: (context: string) => void
  uploadedPDFs: string[]
  addPDF: (filename: string) => void
  removePDF: (filename: string) => void

  // Session
  sessionId: string
  initSession: () => void

  // Conversation turns (question + AI answer pairs)
  turns: Turn[]
  currentInterimCaption: string
  addTurn: (question: string) => string          // returns turn id
  appendToTurn: (id: string, chunk: string) => void
  finalizeTurn: (id: string) => void
  updateTurnTranslation: (id: string, translation: string) => void
  setCurrentInterimCaption: (text: string) => void
  clearTurns: () => void

  // Recording
  isRecording: boolean
  setIsRecording: (v: boolean) => void

  // UI
  stealthMode: boolean
  toggleStealth: () => void
}

export const useInterviewStore = create<InterviewStore>()(
  persist(
    (set) => ({
      phase: 'setup',
      setPhase: (phase) => set({ phase }),

      context: '',
      setContext: (context) => set({ context }),

      uploadedPDFs: [],
      addPDF: () => {},
      removePDF: () => {},

      sessionId: '',
      initSession: () => set({ sessionId: Date.now().toString(), turns: [], currentInterimCaption: '' }),

      turns: [],
      currentInterimCaption: '',
      addTurn: (question) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        set((s) => ({
          turns: [
            ...s.turns.slice(-49),
            { id, question, timestamp: new Date().toISOString(), answer: '', isGenerating: true },
          ],
          currentInterimCaption: '',
        }))
        return id
      },
      appendToTurn: (id, chunk) =>
        set((s) => ({
          turns: s.turns.map((t) => (t.id === id ? { ...t, answer: t.answer + chunk } : t)),
        })),
      finalizeTurn: (id) =>
        set((s) => ({
          turns: s.turns.map((t) => (t.id === id ? { ...t, isGenerating: false } : t)),
        })),
      updateTurnTranslation: (id, translation) =>
        set((s) => ({
          turns: s.turns.map((t) => (t.id === id ? { ...t, questionTranslation: translation } : t)),
        })),
      setCurrentInterimCaption: (text) => set({ currentInterimCaption: text }),
      clearTurns: () => set({ turns: [], currentInterimCaption: '' }),

      isRecording: false,
      setIsRecording: (isRecording) => set({ isRecording }),

      stealthMode: false,
      toggleStealth: () => set((s) => ({ stealthMode: !s.stealthMode })),
    }),
    {
      name: 'interview-copilot-store',
      partialize: (state) => ({
        context: state.context,
        uploadedPDFs: state.uploadedPDFs,
      }),
    },
  ),
)
