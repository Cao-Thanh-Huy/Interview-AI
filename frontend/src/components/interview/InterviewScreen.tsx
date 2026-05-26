import { useCallback, useEffect, useRef, useState } from 'react'
import { useDeepgram } from '@/hooks/useDeepgram'
import { useInterviewStore } from '@/store/useInterviewStore'
import { streamCompletion, translateText } from '@/lib/api'

import { TopBar } from './TopBar'
import { MiniPlayer } from './MiniPlayer'

// --- Buffer for summary turn ---
const SUMMARY_LABEL = '🔁 Full context';

const HISTORY_WINDOW = 8 // number of recent finalized turns to send as context

export function InterviewScreen() {
  // Buffer state for summary turn
  const bufferRef = useRef<string[]>([])
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [_, forceRerender] = useState(0) // for UI update if needed
  const context = useInterviewStore((s) => s.context)
  const sessionId = useInterviewStore((s) => s.sessionId)
  const uploadedPDFs = useInterviewStore((s) => s.uploadedPDFs)
  const turns = useInterviewStore((s) => s.turns)
  const addTurn = useInterviewStore((s) => s.addTurn)
  const appendToTurn = useInterviewStore((s) => s.appendToTurn)
  const finalizeTurn = useInterviewStore((s) => s.finalizeTurn)
  const updateTurnTranslation = useInterviewStore((s) => s.updateTurnTranslation)
  const updateTurnQuestion = useInterviewStore((s) => s.updateTurnQuestion)
  const setCurrentInterimCaption = useInterviewStore((s) => s.setCurrentInterimCaption)
  const setIsRecording = useInterviewStore((s) => s.setIsRecording)
  const setPhase = useInterviewStore((s) => s.setPhase)
  const stealthMode = useInterviewStore((s) => s.stealthMode)
  const toggleStealth = useInterviewStore((s) => s.toggleStealth)

  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)

  // Cấu hình độ nhạy phỏng vấn lấy từ .env qua Vite
  const DEBOUNCE_MS = parseInt(String(import.meta.env.VITE_INTERIM_DEBOUNCE_MS ?? '500'), 10) || 500
  const SILENCE_MS = parseInt(String(import.meta.env.VITE_FINAL_SILENCE_MS ?? '1000'), 10) || 1000

  const startTimeRef = useRef(Date.now())
  const abortRef = useRef<AbortController | null>(null)
  const autoOpenedMiniRef = useRef(false)
  const wasConnectedRef = useRef(false)

  // Refs quản lý các bộ hẹn giờ song luồng & active turn
  const interimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const finalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeTurnIdRef = useRef<string | null>(null)
  const lastTranslatedTextRef = useRef<string>('')
  const activeQuestionRef = useRef<string>('')
  const lastLiveHintWordCountRef = useRef<number>(0)

  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // --- Luồng 1: Live Hint (Gợi ý AI dở dang & Dịch song song) ---
  const triggerLiveHint = useCallback(
    async (id: string, text: string) => {
      if (!text.trim()) return

      // Dịch song song đoạn chữ dở dang sang tiếng Việt
      if (lastTranslatedTextRef.current !== text) {
        lastTranslatedTextRef.current = text
        translateText(text)
          .then((vietnameseText) => {
            updateTurnTranslation(id, vietnameseText)
          })
          .catch((err) => console.warn('Failed to translate question (Live Hint):', err))
      }

      // Hủy kết nối stream Groq cũ đang chạy
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const recentHistory = turns
        .filter((t) => !t.isGenerating && t.answer && t.id !== id)
        .slice(-HISTORY_WINDOW)
        .map((t) => ({ question: t.question, answer: t.answer }))

      try {
        // Reset nội dung AI suggestions trước khi ghi đè dở dang mới
        useInterviewStore.setState((s) => ({
          turns: s.turns.map((t) => (t.id === id ? { ...t, answer: '' } : t)),
        }))

        await streamCompletion(
          text,
          context,
          'copilot',
          (chunk) => appendToTurn(id, chunk),
          ctrl.signal,
          sessionId || undefined,
          recentHistory,
        )
      } catch (err) {
        const error = err as Error
        if (error.name !== 'AbortError') {
          console.error('Groq stream error (Live Hint):', error)
        }
      }
    },
    [context, sessionId, turns, appendToTurn, updateTurnTranslation],
  )

  // --- Luồng 2: Refinement (Chốt câu hoàn chỉnh & Dịch chính thức) ---
  const triggerFinalRefinement = useCallback(
    async (id: string, text: string, isManual?: boolean) => {
      if (!text.trim()) return

      // Hủy bộ đếm thời gian đang chờ
      if (interimTimerRef.current) clearTimeout(interimTimerRef.current)
      if (finalTimerRef.current) clearTimeout(finalTimerRef.current)

      setCurrentInterimCaption('')
      activeTurnIdRef.current = null // Giải phóng active turn
      activeQuestionRef.current = ''
      lastTranslatedTextRef.current = ''
      lastLiveHintWordCountRef.current = 0 // Reset bộ đếm từ vựng cho câu mới

      // Dịch thuật chính thức toàn câu
      translateText(text)
        .then((vietnameseText) => {
          updateTurnTranslation(id, vietnameseText)
        })
        .catch((err) => console.warn('Failed to translate question (Final):', err))

      // Hủy stream Live Hint cũ của Luồng 1
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      // --- Xử lý Buffer tóm tắt (nếu ngắt quãng nhiều đoạn) ---
      if (isManual) {
        bufferRef.current = []
      } else {
        bufferRef.current.push(text)
        if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current)
        bufferTimerRef.current = setTimeout(() => {
          if (bufferRef.current.length > 1) {
            const summaryText = bufferRef.current.join(' ')
            const summaryId = addTurn(`${SUMMARY_LABEL}: ${summaryText}`)
            const recentHistory = turns
              .filter((t) => !t.isGenerating && t.answer && t.id !== id && t.id !== summaryId)
              .slice(-HISTORY_WINDOW)
              .map((t) => ({ question: t.question, answer: t.answer }))

            streamCompletion(
              summaryText,
              context,
              'summarizer',
              (chunk) => appendToTurn(summaryId, chunk),
              undefined,
              sessionId || undefined,
              recentHistory,
            ).finally(() => finalizeTurn(summaryId))
          }
          bufferRef.current = []
          forceRerender((v) => v + 1)
        }, 1000)
      }

      const recentHistory = turns
        .filter((t) => !t.isGenerating && t.answer && t.id !== id)
        .slice(-HISTORY_WINDOW)
        .map((t) => ({ question: t.question, answer: t.answer }))

      try {
        // Reset nội dung AI suggestions để chuẩn bị ghi gợi ý chính thức tối ưu nhất
        useInterviewStore.setState((s) => ({
          turns: s.turns.map((t) => (t.id === id ? { ...t, answer: '' } : t)),
        }))

        await streamCompletion(
          text,
          context,
          'copilot',
          (chunk) => appendToTurn(id, chunk),
          ctrl.signal,
          sessionId || undefined,
          recentHistory,
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
    [context, sessionId, turns, addTurn, appendToTurn, finalizeTurn, updateTurnTranslation, setCurrentInterimCaption],
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

  const handleError = useCallback((msg: string) => setErrorMessage(msg), [])
  const handleWarning = useCallback((msg: string) => setWarningMessage(msg), [])

  // Wrap onUtteranceEnd to support isManual param
  const handleUtteranceEndWrapper = useCallback((text: string) => handleUtteranceEnd(text, false), [handleUtteranceEnd])
  const handleManualSubmit = useCallback((text: string) => handleUtteranceEnd(text, true), [handleUtteranceEnd])

  const { start, stop, status, audioSource, isMuted, toggleMute } = useDeepgram({
    onTranscript: handleTranscript,
    onUtteranceEnd: handleUtteranceEndWrapper,
    onStatusChange: handleStatusChange,
    onError: handleError,
    onWarning: handleWarning,
  })

  // Auto-open mini player once connected
  useEffect(() => {
    if (status === 'connected') {
      wasConnectedRef.current = true
      if (!autoOpenedMiniRef.current) {
        autoOpenedMiniRef.current = true
        setIsMiniPlayerOpen(true)
      }
    }
    // Connection dropped after being connected → go back to setup
    if (status === 'idle' && wasConnectedRef.current) {
      wasConnectedRef.current = false
      abortRef.current?.abort()
      setPhase('setup')
    }
  }, [status, setPhase])

  // Auto-start on mount
  useEffect(() => {
    start()
    return () => stop()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStop = useCallback(() => {
    wasConnectedRef.current = false
    abortRef.current?.abort()
    stop()
    setPhase('setup')
  }, [stop, setPhase])

  // When mini player is open, render as child portal/fallback inside the layout to avoid blank main page
  // early return removed to keep main control panel active and lightweight

  // Stealth mode — show only a tiny floating dot
  if (stealthMode) {
    return (
      <div className="fixed inset-0 pointer-events-none z-50">
        <button
          className="pointer-events-auto fixed bottom-5 right-5 w-9 h-9 rounded-full bg-white/10 backdrop-blur-xl border border-white/15 flex items-center justify-center hover:bg-white/15 transition-colors"
          onClick={toggleStealth}
          title="Show Copilot (Ctrl+Shift+H)"
        >
          <span className="text-xs">👁</span>
        </button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#f6f8fb] overflow-hidden relative">
      {/* Ambient glows - paused when tab is hidden to release GPU blur operations */}
      {isTabVisible && (
        <>
          <div
            aria-hidden
            className="absolute top-0 right-0 w-[350px] h-[350px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"
          />
          <div
            aria-hidden
            className="absolute bottom-0 left-0 w-[250px] h-[250px] bg-sky-400/5 rounded-full blur-[80px] pointer-events-none"
          />
        </>
      )}

      <TopBar
        status={status}
        audioSource={audioSource}
        startTime={startTimeRef.current}
        onStop={handleStop}
        errorMessage={errorMessage}
        warningMessage={warningMessage}
        onDismissWarning={() => setWarningMessage(null)}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        isMiniPlayerOpen={isMiniPlayerOpen}
        onToggleMiniPlayer={() => setIsMiniPlayerOpen(!isMiniPlayerOpen)}
      />


      {/* Ultra-lightweight glassmorphic Control Panel instead of ConversationFeed */}
      <div className="flex-1 p-6 flex flex-col items-center justify-center relative z-10">
        <div className="glass max-w-sm w-full rounded-2xl p-6 text-center space-y-4 shadow-xl border border-slate-200/50 bg-white/40 backdrop-blur-xl">
          <div className="flex justify-center items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-red-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
              {status === 'connected' ? 'Session Live' : 'Session Offline'}
            </span>
          </div>
          <h2 className="text-sm font-semibold text-slate-800">Copilot Session Control</h2>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Your interview session is currently active. Transcripts, AI Suggestions, and translations are handled inside the **Copilot Mini HUD**.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            {!isMiniPlayerOpen ? (
              <button
                onClick={() => setIsMiniPlayerOpen(true)}
                className="w-full py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-md transition-colors cursor-pointer"
              >
                Open Copilot Mini HUD
              </button>
            ) : (
              <p className="text-[10px] text-slate-400 bg-slate-100/50 py-1.5 px-3 rounded-lg border border-slate-200/20">
                Copilot Mini HUD is open
              </p>
            )}
            <button
              onClick={handleStop}
              className="w-full py-2 px-4 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 font-medium text-xs transition-colors cursor-pointer"
            >
              Stop Interview Session
            </button>
          </div>
        </div>
      </div>

      {isMiniPlayerOpen && (
        <MiniPlayer
          onClose={() => setIsMiniPlayerOpen(false)}
          isRecording={status === 'connected'}
          audioSource={audioSource}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onStop={handleStop}
          onManualSubmit={handleManualSubmit}
        />
      )}
    </div>
  )
}
