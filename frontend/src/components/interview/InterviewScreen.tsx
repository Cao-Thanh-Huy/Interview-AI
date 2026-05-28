import { useCallback, useEffect, useRef, useState } from 'react'
import { useDeepgram } from '@/hooks/useDeepgram'
import { useInterviewStore } from '@/store/useInterviewStore'
import { streamCompletion, translateText } from '@/lib/api'
import { InterviewScreenLayout } from './InterviewScreenLayout'

// --- Buffer for summary turn ---
const SUMMARY_LABEL = '🔁 Full context';

const HISTORY_WINDOW = 8 // number of recent finalized turns to send as context

export function InterviewScreen() {
  const context = useInterviewStore((s) => s.context)
  const sessionId = useInterviewStore((s) => s.sessionId)
  const audioDeviceId = useInterviewStore((s) => s.audioDeviceId)
  const turns = useInterviewStore((s) => s.turns)
  const addTurn = useInterviewStore((s) => s.addTurn)
  const appendToTurn = useInterviewStore((s) => s.appendToTurn)
  const setTurnAnswer = useInterviewStore((s) => s.setTurnAnswer)
  const finalizeTurn = useInterviewStore((s) => s.finalizeTurn)
  const updateTurnTranslation = useInterviewStore((s) => s.updateTurnTranslation)
  const updateTurnQuestion = useInterviewStore((s) => s.updateTurnQuestion)
  const setCurrentInterimCaption = useInterviewStore((s) => s.setCurrentInterimCaption)
  const setIsRecording = useInterviewStore((s) => s.setIsRecording)
  const setPhase = useInterviewStore((s) => s.setPhase)

  // Cấu hình độ nhạy phỏng vấn lấy từ .env qua Vite
  // Cấu hình độ nhạy phỏng vấn lấy từ .env qua Vite
  const DEBOUNCE_MS = parseInt(String(import.meta.env.VITE_INTERIM_DEBOUNCE_MS ?? '500'), 10) || 500
  const SILENCE_MS = parseInt(String(import.meta.env.VITE_FINAL_SILENCE_MS ?? '1000'), 10) || 1000

  const startTimeRef = useRef(Date.now())
  const abortRef = useRef<AbortController | null>(null)
  const wasConnectedRef = useRef(false)

  // Refs quản lý các bộ hẹn giờ song luồng & active turn
  const interimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeTurnIdRef = useRef<string | null>(null)
  const lastTranslatedTextRef = useRef<string>('')
  const activeQuestionRef = useRef<string>('')
  const lastLiveHintWordCountRef = useRef<number>(0)

  // ── Chunk batching: batch 50ms of stream chunks before setState ─────────────
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


  // --- Luồng 1: Live Hint (Gợi ý AI dở dang & Dịch song song) ---
  const triggerLiveHint = useCallback(
    async (id: string, text: string) => {
      if (!text.trim()) return

      if (lastTranslatedTextRef.current !== text) {
        lastTranslatedTextRef.current = text
        translateText(text)
          .then((vietnameseText) => updateTurnTranslation(id, vietnameseText))
          .catch((err) => console.warn('Failed to translate question (Live Hint):', err))
      }

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const recentHistory = turns
        .filter((t) => !t.isGenerating && t.answer && t.id !== id)
        .slice(-HISTORY_WINDOW)
        .map((t) => ({ question: t.question, answer: t.answer }))

      try {
        let isFirstChunk = true
        await streamCompletion(
          text, context, 'copilot',
          (chunk) => {
            if (isFirstChunk) {
              setTurnAnswer(id, chunk)
              isFirstChunk = false
            } else {
              batchedAppend(id, chunk)   // ← batch 50ms
            }
          },
          ctrl.signal, sessionId || undefined, recentHistory,
        )
      } catch (err) {
        const error = err as Error
        if (error.name !== 'AbortError') console.error('Groq stream error (Live Hint):', error)
      }
    },
    [context, sessionId, turns, batchedAppend, setTurnAnswer, updateTurnTranslation],
  )

  // --- Luồng 2: Refinement (Chốt câu hoàn chỉnh & Dịch chính thức) ---
  const triggerFinalRefinement = useCallback(
    async (id: string, text: string, isManual?: boolean) => {
      if (!text.trim()) return

      if (interimTimerRef.current) clearTimeout(interimTimerRef.current)
      if (finalTimerRef.current) clearTimeout(finalTimerRef.current)

      setCurrentInterimCaption('')
      activeTurnIdRef.current = null
      activeQuestionRef.current = ''
      lastTranslatedTextRef.current = ''
      lastLiveHintWordCountRef.current = 0

      translateText(text)
        .then((t) => updateTurnTranslation(id, t))
        .catch((err) => console.warn('Failed to translate question (Final):', err))

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const recentHistory = turns
        .filter((t) => !t.isGenerating && t.answer && t.id !== id)
        .slice(-HISTORY_WINDOW)
        .map((t) => ({ question: t.question, answer: t.answer }))

      try {
        let isFirstChunk = true
        await streamCompletion(
          text, context, 'copilot',
          (chunk) => {
            if (isFirstChunk) {
              setTurnAnswer(id, chunk)
              isFirstChunk = false
            } else {
              batchedAppend(id, chunk)   // ← batch 50ms
            }
          },
          ctrl.signal, sessionId || undefined, recentHistory,
        )
      } catch (err) {
        const error = err as Error
        if (error.name !== 'AbortError') {
          console.error('Groq stream error (Final Refinement):', error)
          appendToTurn(id, '_⚠️ AI service error._')
        }
      } finally {
        finalizeTurn(id)
      }
    },
    [context, sessionId, turns, addTurn, appendToTurn, batchedAppend, finalizeTurn, updateTurnTranslation, setCurrentInterimCaption],
  )

  // Phản hồi dứt câu của Deepgram hoặc kích hoạt thủ công
  const handleUtteranceEnd = useCallback(
    async (fullTranscript: string, isManual?: boolean) => {
      if (!fullTranscript.trim()) return

      let activeId = activeTurnIdRef.current

      if (isManual) {
        // Nhập bằng tay -> Chốt hạ tức thì
        if (!activeId) {
          activeId = addTurn(fullTranscript)
        } else {
          updateTurnQuestion(activeId, fullTranscript)
        }
        await triggerFinalRefinement(activeId, fullTranscript, true)
      } else {
        // Nói bằng giọng nói -> Ghép câu thông minh (cộng dồn)
        if (!activeId) {
          // BỎ QUA hoàn toàn sự kiện UtteranceEnd tự động của Deepgram nếu đã được chốt câu trước đó bởi timer 2s
          return
        }

        const newCombined = `${activeQuestionRef.current} ${fullTranscript}`.trim()
        activeQuestionRef.current = newCombined
        updateTurnQuestion(activeId, newCombined)

        // Gọi sinh Live Hint cho toàn bộ câu hỏi đã cộng dồn
        await triggerLiveHint(activeId, activeQuestionRef.current)

        // Đặt lại bộ đếm thời gian chốt hạ 2 giây dựa trên câu hỏi cộng dồn
        if (finalTimerRef.current) clearTimeout(finalTimerRef.current)
        finalTimerRef.current = setTimeout(() => {
          if (activeTurnIdRef.current) {
            triggerFinalRefinement(activeTurnIdRef.current, activeQuestionRef.current, false)
          }
        }, SILENCE_MS)
      }
    },
    [addTurn, updateTurnQuestion, triggerLiveHint, triggerFinalRefinement, SILENCE_MS],
  )

  // Điều phối nhận chữ thời gian thực từ Deepgram để đếm Timers
  const handleTranscript = useCallback(
    (text: string, isFinal?: boolean) => {
      setCurrentInterimCaption(text)
      if (!text.trim()) return

      let activeId = activeTurnIdRef.current
      // Câu hỏi đầy đủ bao gồm phần đã chốt dở dang + chữ đang nói tạm thời của phân đoạn hiện tại
      const combinedText = activeQuestionRef.current
        ? `${activeQuestionRef.current} ${text}`.trim()
        : text

      if (!activeId) {
        // TỰ ĐỘNG KHÔI PHỤC (Self-healing):
        // Nếu activeId đang null, nhưng câu mới này thực chất là phần tiếp nối (superset)
        // của lượt thoại cuối cùng trong store, thì ta khôi phục lại lượt thoại đó thay vì addTurn mới!
        const currentTurns = useInterviewStore.getState().turns
        const lastTurn = currentTurns[currentTurns.length - 1]
        
        if (lastTurn && combinedText.startsWith(lastTurn.question.trim())) {
          activeId = lastTurn.id
          activeTurnIdRef.current = activeId
          updateTurnQuestion(activeId, combinedText)
        } else {
          activeId = addTurn(combinedText)
          activeTurnIdRef.current = activeId
        }
      } else {
        updateTurnQuestion(activeId, combinedText)
      }

      // --- BỘ ĐẾM 1: DEBOUNCE (LIVE HINT) ---
      if (interimTimerRef.current) clearTimeout(interimTimerRef.current)
      interimTimerRef.current = setTimeout(() => {
        const wordCount = combinedText.split(/\s+/).filter(Boolean).length
        const lastWordCount = lastLiveHintWordCountRef.current
        const newWordsSpoken = wordCount - lastWordCount

        if (newWordsSpoken >= 5) {
          lastLiveHintWordCountRef.current = wordCount
          triggerLiveHint(activeId!, combinedText)
        }
      }, DEBOUNCE_MS)

      // --- BỘ ĐẾM 2: CHỐT CÂU (FINAL REFINEMENT) ---
      if (finalTimerRef.current) clearTimeout(finalTimerRef.current)
      if (isFinal) {
        finalTimerRef.current = setTimeout(() => {
          if (activeTurnIdRef.current) {
            const finalPromptText = activeQuestionRef.current || combinedText
            triggerFinalRefinement(activeTurnIdRef.current, finalPromptText, false)
          }
        }, SILENCE_MS)
      }
    },
    [addTurn, updateTurnQuestion, triggerLiveHint, triggerFinalRefinement, DEBOUNCE_MS, SILENCE_MS, setCurrentInterimCaption],
  )

  const handleStatusChange = useCallback(
    (s: import('@/lib/types').DeepgramStatus) => setIsRecording(s === 'connected'),
    [setIsRecording],
  )

  const handleUtteranceEndWrapper = useCallback((text: string) => handleUtteranceEnd(text, false), [handleUtteranceEnd])
  const handleManualSubmit = useCallback((text: string) => handleUtteranceEnd(text, true), [handleUtteranceEnd])

  const { start, stop, status, audioSource, isMuted, toggleMute, audioLevel } = useDeepgram({
    onTranscript: handleTranscript,
    onUtteranceEnd: handleUtteranceEndWrapper,
    onStatusChange: handleStatusChange,
    onError: (msg) => console.error('[Deepgram error]', msg),
    onWarning: (msg) => console.warn('[Deepgram warn]', msg),
  })

  // Auto-start / reconnect lifecycle
  useEffect(() => {
    if (status === 'connected') wasConnectedRef.current = true
    if (status === 'idle') {
      if (wasConnectedRef.current) {
        // Was connected, now disconnected → back to setup
        wasConnectedRef.current = false
        abortRef.current?.abort()
        setPhase('setup')
      } else {
        // Never connected (start() failed / user cancelled) → back to setup after 2s
        const t = setTimeout(() => setPhase('setup'), 2000)
        return () => clearTimeout(t)
      }
    }
  }, [status, setPhase])

  // Auto-start on mount — Electron path: WASAPI loopback (no setup needed)
  // Browser path: getUserMedia with selected deviceId
  useEffect(() => {
    start(audioDeviceId ?? undefined)
    return () => stop()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStop = useCallback(() => {
    wasConnectedRef.current = false
    abortRef.current?.abort()
    stop()
    setPhase('setup')
  }, [stop, setPhase])



  return (
    <div style={{ height: '100%' }}>
      <InterviewScreenLayout
        status={status}
        audioSource={audioSource}
        audioLevel={audioLevel}
        startTime={startTimeRef.current}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onStop={handleStop}
        onManualSubmit={handleManualSubmit}
      />
    </div>
  )
}
