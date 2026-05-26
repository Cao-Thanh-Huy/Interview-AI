import { useCallback, useEffect, useRef, useState } from 'react'
import { useDeepgram } from '@/hooks/useDeepgram'
import { useInterviewStore } from '@/store/useInterviewStore'
import { streamCompletion } from '@/lib/api'

import { TopBar } from './TopBar'
import { ConversationFeed } from './ConversationFeed'
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
  const setCurrentInterimCaption = useInterviewStore((s) => s.setCurrentInterimCaption)
  const setIsRecording = useInterviewStore((s) => s.setIsRecording)
  const setPhase = useInterviewStore((s) => s.setPhase)
  const stealthMode = useInterviewStore((s) => s.stealthMode)
  const toggleStealth = useInterviewStore((s) => s.toggleStealth)

  const [isMiniPlayerOpen, setIsMiniPlayerOpen] = useState(false)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)

  const startTimeRef = useRef(Date.now())
  const abortRef = useRef<AbortController | null>(null)
  const autoOpenedMiniRef = useRef(false)
  const wasConnectedRef = useRef(false)

  useEffect(() => {
    const handleVisibility = () => {
      setIsTabVisible(document.visibilityState === 'visible')
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // --- Main utterance end handler (old flow) ---
  const handleUtteranceEnd = useCallback(
    async (fullTranscript: string, isManual?: boolean) => {
      if (!fullTranscript.trim()) return

      setCurrentInterimCaption('')
      const id = addTurn(fullTranscript)

      // --- Buffer logic (new flow) ---
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current)
      if (isManual) {
        bufferRef.current = [] // clear buffer on manual submit
      } else {
        bufferRef.current.push(fullTranscript)
        // Reset timer to 1s
        bufferTimerRef.current = setTimeout(() => {
          // Only send summary if buffer has >1 utterance
          if (bufferRef.current.length > 1) {
            const summaryText = bufferRef.current.join(' ')
            // Add summary turn with label
            const summaryId = addTurn(`${SUMMARY_LABEL}: ${summaryText}`)
            // Use summarizer mode for this turn
            const recentHistory = turns
              .filter((t) => !t.isGenerating && t.answer)
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

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      // Build recent history for context window (last N finalized turns)
      const recentHistory = turns
        .filter((t) => !t.isGenerating && t.answer)
        .slice(-HISTORY_WINDOW)
        .map((t) => ({ question: t.question, answer: t.answer }))

      try {
        await streamCompletion(
          fullTranscript,
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
          console.error('Groq stream error:', error)
          appendToTurn(id, '_⚠️ AI service error._')
        }
      } finally {
        finalizeTurn(id)
      }
    },
    [context, sessionId, turns, addTurn, appendToTurn, finalizeTurn, setCurrentInterimCaption],
  )

  const handleTranscript = useCallback(
    (text: string) => {
      setCurrentInterimCaption(text)
    },
    [setCurrentInterimCaption],
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

  // When mini player is open, blank the main page — all UI lives in the mini player
  if (isMiniPlayerOpen) {
    return (
      <MiniPlayer
        onClose={() => setIsMiniPlayerOpen(false)}
        isRecording={status === 'connected'}
        audioSource={audioSource}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        onStop={handleStop}
        onManualSubmit={handleManualSubmit}
      />
    )
  }

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


      <div className="flex-1 p-3 overflow-hidden relative z-10">
        <ConversationFeed />
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
