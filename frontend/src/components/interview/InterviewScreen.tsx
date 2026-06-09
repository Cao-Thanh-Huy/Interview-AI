import { useCallback, useRef } from 'react'
import { useInterviewStore } from '@/store/useInterviewStore'
import { streamCompletion, translateText } from '@/lib/api'
import { InterviewScreenLayout } from './InterviewScreenLayout'

export function InterviewScreen() {
  const context = useInterviewStore((s) => s.context)
  const sessionId = useInterviewStore((s) => s.sessionId)
  const turns = useInterviewStore((s) => s.turns)
  const addTurn = useInterviewStore((s) => s.addTurn)
  const appendToTurn = useInterviewStore((s) => s.appendToTurn)
  const finalizeTurn = useInterviewStore((s) => s.finalizeTurn)
  const setTurnAnswer = useInterviewStore((s) => s.setTurnAnswer)
  const updateTurnTranslation = useInterviewStore((s) => s.updateTurnTranslation)
  const updateTurnQuestion = useInterviewStore((s) => s.updateTurnQuestion)
  const setPhase = useInterviewStore((s) => s.setPhase)

  const startTimeRef = useRef(Date.now())
  const abortRef = useRef<AbortController | null>(null)

  // ── Chunk batching: gom 50ms chunks trước khi setState ──────────
  const batchBufferRef = useRef<Record<string, string>>({})
  const batchTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const batchedAppend = useCallback((id: string, chunk: string) => {
    batchBufferRef.current[id] = (batchBufferRef.current[id] ?? '') + chunk
    if (batchTimerRef.current[id]) clearTimeout(batchTimerRef.current[id])
    batchTimerRef.current[id] = setTimeout(() => {
      const buffered = batchBufferRef.current[id]
      if (buffered) {
        appendToTurn(id, buffered)
        batchBufferRef.current[id] = ''
      }
    }, 50)
  }, [appendToTurn])

  // ── Manual submit — gõ câu hỏi tay, gọi LLM ───────────────────
  const handleManualSubmit = useCallback(
    async (fullTranscript: string) => {
      if (!fullTranscript.trim()) return

      abortRef.current?.abort()
      abortRef.current = new AbortController()

      const id = addTurn(fullTranscript)
      updateTurnQuestion(id, fullTranscript)

      translateText(fullTranscript)
        .then((v) => updateTurnTranslation(id, v))
        .catch((err) => console.warn('Translation error:', err))

      try {
        let isFirstChunk = true
        await streamCompletion(
          fullTranscript, context, 'copilot',
          (chunk) => {
            if (isFirstChunk) {
              setTurnAnswer(id, chunk)
              isFirstChunk = false
            } else {
              batchedAppend(id, chunk)
            }
          },
          abortRef.current.signal,
          sessionId || undefined,
          [],
        )
      } catch (err) {
        const error = err as Error
        if (error.name !== 'AbortError') {
          console.error('Stream error:', error)
          appendToTurn(id, '_⚠️ AI service error._')
        }
      } finally {
        finalizeTurn(id)
      }
    },
    [context, sessionId, addTurn, appendToTurn, batchedAppend, setTurnAnswer, finalizeTurn, updateTurnTranslation, updateTurnQuestion],
  )

  return (
    <div style={{ height: '100%' }}>
      <InterviewScreenLayout
        status="idle"
        audioSource={null}
        audioLevel={0}
        startTime={startTimeRef.current}
        isMuted={false}
        onToggleMute={() => {}}
        onStop={() => setPhase('setup')}
        onManualSubmit={handleManualSubmit}
      />
    </div>
  )
}
