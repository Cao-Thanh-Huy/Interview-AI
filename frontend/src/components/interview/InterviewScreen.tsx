import { useCallback, useEffect, useRef, useState } from 'react'
import { useDeepgram } from '@/hooks/useDeepgram'
import { useInterviewStore } from '@/store/useInterviewStore'
import { streamCompletion, listPDFs } from '@/lib/api'
import { TopBar } from './TopBar'
import { ConversationFeed } from './ConversationFeed'

export function InterviewScreen() {
  const {
    context,
    uploadedPDFs,
    addTurn,
    appendToTurn,
    finalizeTurn,
    setCurrentInterimCaption,
    setIsRecording,
    setPhase,
    stealthMode,
    toggleStealth,
  } = useInterviewStore()

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [cvWarning, setCvWarning] = useState(false)
  const startTimeRef = useRef(Date.now())
  const abortRef = useRef<AbortController | null>(null)

  const handleUtteranceEnd = useCallback(
    async (fullTranscript: string) => {
      if (!fullTranscript.trim()) return

      setCurrentInterimCaption('')
      const id = addTurn(fullTranscript)

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        await streamCompletion(
          fullTranscript,
          context,
          'copilot',
          (chunk) => appendToTurn(id, chunk),
          ctrl.signal,
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
    [context, addTurn, appendToTurn, finalizeTurn, setCurrentInterimCaption],
  )

  const handleTranscript = useCallback(
    (text: string, isFinal: boolean) => {
      if (!isFinal) {
        setCurrentInterimCaption(text)
      } else {
        setCurrentInterimCaption('')
      }
    },
    [setCurrentInterimCaption],
  )

  const handleStatusChange = useCallback(
    (s: import('@/lib/types').DeepgramStatus) => setIsRecording(s === 'connected'),
    [setIsRecording],
  )

  const handleError = useCallback((msg: string) => setErrorMessage(msg), [])

  const { start, stop, status, audioSource } = useDeepgram({
    onTranscript: handleTranscript,
    onUtteranceEnd: handleUtteranceEnd,
    onStatusChange: handleStatusChange,
    onError: handleError,
  })

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
    abortRef.current?.abort()
    stop()
    setPhase('setup')
  }, [stop, setPhase])

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
    <div className="h-screen flex flex-col bg-[#0a0a0f] overflow-hidden relative">
      {/* Ambient glows */}
      <div
        aria-hidden
        className="absolute top-0 right-0 w-[350px] h-[350px] bg-violet-600/5 rounded-full blur-[100px] pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute bottom-0 left-0 w-[250px] h-[250px] bg-cyan-500/5 rounded-full blur-[80px] pointer-events-none"
      />

      <TopBar
        status={status}
        audioSource={audioSource}
        startTime={startTimeRef.current}
        onStop={handleStop}
        errorMessage={errorMessage}
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
    </div>
  )
}
