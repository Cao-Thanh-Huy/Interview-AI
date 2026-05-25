import { useCallback, useEffect, useRef, useState } from 'react'
import { useDeepgram } from '@/hooks/useDeepgram'
import { useInterviewStore } from '@/store/useInterviewStore'
import { streamCompletion, listPDFs } from '@/lib/api'
import { TopBar } from './TopBar'
import { ConversationFeed } from './ConversationFeed'
import { MiniPlayer } from './MiniPlayer'

const HISTORY_WINDOW = 8 // number of recent finalized turns to send as context

export function InterviewScreen() {
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
  const [cvWarning, setCvWarning] = useState(false)
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

  const handleUtteranceEnd = useCallback(
    async (fullTranscript: string) => {
      if (!fullTranscript.trim()) return

      setCurrentInterimCaption('')
      const id = addTurn(fullTranscript)

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

  const { start, stop, status, audioSource, isMuted, toggleMute } = useDeepgram({
    onTranscript: handleTranscript,
    onUtteranceEnd: handleUtteranceEnd,
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

  // Auto-start on mount + CV check
  useEffect(() => {
    start()

    // Check if CV the user uploaded is still in backend memory
    if (uploadedPDFs.length > 0) {
      listPDFs()
        .then(({ documents }) => {
          const missing = uploadedPDFs.some((f) => !documents.includes(f))
          if (missing) setCvWarning(true)
        })
        .catch(() => {}) // non-critical
    }

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
        onManualSubmit={handleUtteranceEnd}
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

      {cvWarning && (
        <div className="relative z-10 mx-3 mt-1 flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-300/90">
          <span>
            ⚠️ CV not loaded in backend (server may have restarted). Go back to Setup and re-upload your CV for personalized answers.
          </span>
          <button
            className="shrink-0 text-amber-400/60 hover:text-amber-300 transition-colors"
            onClick={() => setCvWarning(false)}
          >
            ✕
          </button>
        </div>
      )}

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
        />
      )}
    </div>
  )
}
