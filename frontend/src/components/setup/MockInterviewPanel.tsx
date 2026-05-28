import { useCallback, useEffect, useRef, useState } from 'react'
import { BrainCircuit, Mic, MicOff, ChevronRight, RotateCcw, Volume2, VolumeX, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { streamCompletion, fetchTTSAudio, streamMockScoring } from '@/lib/api'
import { useInterviewStore } from '@/store/useInterviewStore'
import type { MockTurn, MockTurnPhase } from '@/lib/types'
import { fetchDeepgramKey } from '@/lib/api'

// ── Deepgram STT (mic-only, no screen share) ──────────────────────────────────
function useMockMic(options: {
  onTranscript: (text: string, isFinal: boolean) => void
  onUtteranceEnd: (text: string) => void
}) {
  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pendingRef = useRef('')
  const [isRecording, setIsRecording] = useState(false)

  const start = useCallback(async () => {
    if (wsRef.current) return // already open
    try {
      const { key } = await fetchDeepgramKey()
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = mic

      const preferredMime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
        .find((m) => MediaRecorder.isTypeSupported(m)) ?? ''

      const params = new URLSearchParams({
        model: 'nova-2',
        interim_results: 'true',
        smart_format: 'true',
        punctuate: 'true',
        utterance_end_ms: '3000',
        vad_events: 'true',
        endpointing: '400',
        ...(preferredMime.includes('opus') && { encoding: 'opus', container: 'webm' }),
      })

      const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, ['token', key])
      wsRef.current = ws

      ws.onopen = () => {
        const recorder = new MediaRecorder(mic, preferredMime ? { mimeType: preferredMime } : {})
        recorderRef.current = recorder
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data)
        }
        recorder.start(500)
        setIsRecording(true)
      }

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string)
          if (data.type === 'Results') {
            const words: Array<{ punctuated_word?: string; word: string }> =
              data.channel?.alternatives?.[0]?.words ?? []
            const text = words.map((w) => w.punctuated_word ?? w.word).join(' ')
            if (text.trim()) {
              if (data.is_final) {
                pendingRef.current += (pendingRef.current ? ' ' : '') + text
                options.onTranscript(pendingRef.current, true)
              } else {
                options.onTranscript(
                  pendingRef.current ? pendingRef.current + ' ' + text : text,
                  false,
                )
              }
            }
          } else if (data.type === 'UtteranceEnd') {
            const acc = pendingRef.current.trim()
            if (acc) {
              options.onUtteranceEnd(acc)
              pendingRef.current = ''
              options.onTranscript('', true)
            }
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onclose = () => {
        setIsRecording(false)
        recorderRef.current?.stop()
      }
    } catch (err) {
      console.error('[MockMic] start error:', err)
    }
  }, [options])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    pendingRef.current = ''
    setIsRecording(false)
  }, [])

  useEffect(() => () => stop(), [stop])

  return { start, stop, isRecording }
}

// ── Score renderer — parses SCORE: X/10 + ✓/✗ lines ─────────────────────────
function ScoreBlock({ text }: { text: string }) {
  const scoreMatch = text.match(/SCORE:\s*(\d+)\/10/)
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null
  const goods = [...text.matchAll(/✓\s*(.+)/g)].map((m) => m[1].trim())
  const bads = [...text.matchAll(/✗\s*(.+)/g)].map((m) => m[1].trim())

  const starCount = score !== null ? Math.round((score / 10) * 5) : null

  return (
    <div className="mt-3 rounded-xl bg-white/60 border border-slate-200/60 p-3 space-y-2">
      {score !== null && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700">Score:</span>
          <span className="text-yellow-500 text-sm tracking-tight">
            {'★'.repeat(starCount ?? 0)}{'☆'.repeat(5 - (starCount ?? 0))}
          </span>
          <span className="text-xs font-bold text-slate-600">{score}/10</span>
        </div>
      )}
      {goods.map((g, i) => (
        <div key={`g-${i}`} className="flex items-start gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{g}</span>
        </div>
      ))}
      {bads.map((b, i) => (
        <div key={`b-${i}`} className="flex items-start gap-1.5 text-xs text-rose-600">
          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{b}</span>
        </div>
      ))}
      {!scoreMatch && text.trim() && (
        <p className="text-xs text-slate-500 whitespace-pre-wrap">{text}</p>
      )}
    </div>
  )
}

// ── Single turn card ──────────────────────────────────────────────────────────
function TurnCard({ turn, isLatest }: { turn: MockTurn; isLatest: boolean }) {
  const phaseLabel: Record<MockTurnPhase, string> = {
    asking: 'Generating question...',
    suggesting: 'Preparing suggestion...',
    listening: 'Ready — click mic to answer',
    recording: 'Listening...',
    scoring: 'Scoring your answer...',
    done: '',
  }

  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-300',
        isLatest
          ? 'border-indigo-200 bg-white/80 shadow-md shadow-indigo-100/40'
          : 'border-slate-200/50 bg-white/40 shadow-sm',
      )}
    >
      {/* Question header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shrink-0 text-white text-xs font-bold shadow">
          {turn.index}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider">
            Interviewer
          </span>
          <p className="text-sm font-medium text-slate-800 mt-0.5 leading-relaxed">
            {turn.question || (
              <span className="flex items-center gap-1.5 text-slate-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
              </span>
            )}
          </p>
          {isLatest && turn.phase !== 'done' && phaseLabel[turn.phase] && (
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {phaseLabel[turn.phase]}
            </p>
          )}
        </div>
      </div>

      {/* Suggestion hint */}
      {(turn.suggestion || turn.isSuggestionStreaming) && (
        <div className="px-4 pb-3">
          <div className="rounded-xl bg-indigo-50/70 border border-indigo-100 p-3">
            <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wider mb-1.5">
              💡 Suggested Answer
            </p>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
              {turn.suggestion}
              {turn.isSuggestionStreaming && (
                <span className="inline-block w-1.5 h-3.5 bg-indigo-400 animate-pulse ml-0.5 align-middle" />
              )}
            </p>
          </div>
        </div>
      )}

      {/* User transcript (live or finalized) */}
      {(turn.userTranscript || turn.userAnswer || turn.phase === 'recording') && (
        <div className="px-4 pb-3">
          <div className="rounded-xl bg-slate-50/80 border border-slate-200/60 p-3">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5">
              🎙 Your Answer
            </p>
            <p className="text-xs text-slate-600 leading-relaxed min-h-[18px]">
              {turn.userAnswer || turn.userTranscript || (
                <span className="text-slate-300 italic">Speaking...</span>
              )}
              {turn.phase === 'recording' && !turn.userAnswer && (
                <span className="inline-block w-1.5 h-3.5 bg-slate-400 animate-pulse ml-0.5 align-middle" />
              )}
            </p>
          </div>
        </div>
      )}

      {/* Score */}
      {(turn.score || turn.isScoringStreaming) && (
        <div className="px-4 pb-4">
          {turn.isScoringStreaming && !turn.score ? (
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Scoring...
            </div>
          ) : (
            <ScoreBlock text={turn.score} />
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export function MockInterviewPanel() {
  const context = useInterviewStore((s) => s.context)

  const [turns, setTurns] = useState<MockTurn[]>([])
  const [sessionActive, setSessionActive] = useState(false)
  const [isTTSEnabled, setIsTTSEnabled] = useState(true)
  const [ttsPlaying, setTTSPlaying] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentObjectUrl = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const latestTurnRef = useRef<MockTurn | null>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns])

  // Keep ref in sync
  useEffect(() => {
    latestTurnRef.current = turns[turns.length - 1] ?? null
  }, [turns])

  // ── Mic hook ──────────────────────────────────────────────────────────────
  const onTranscript = useCallback((text: string, _isFinal: boolean) => {
    setTurns((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.phase !== 'recording') return prev
      return prev.map((t) => t.id === last.id ? { ...t, userTranscript: text } : t)
    })
  }, [])

  const onUtteranceEnd = useCallback((text: string) => {
    // Stop recording and trigger scoring
    setTurns((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.phase !== 'recording') return prev
      return prev.map((t) => t.id === last.id
        ? { ...t, userAnswer: text, userTranscript: text, phase: 'scoring' as MockTurnPhase }
        : t)
    })
  }, [])

  const { start: startMic, stop: stopMic, isRecording } = useMockMic({ onTranscript, onUtteranceEnd })

  // ── Score trigger when phase flips to 'scoring' ───────────────────────────
  useEffect(() => {
    const last = turns[turns.length - 1]
    if (!last || last.phase !== 'scoring' || last.isScoringStreaming || last.score) return

    setTurns((prev) =>
      prev.map((t) => t.id === last.id ? { ...t, isScoringStreaming: true } : t),
    )

    const ctrl = new AbortController()
    abortRef.current = ctrl

    stopMic() // done recording

    streamMockScoring(
      last.question,
      last.suggestion,
      last.userAnswer,
      context,
      (chunk) => {
        setTurns((prev) =>
          prev.map((t) => t.id === last.id ? { ...t, score: t.score + chunk } : t),
        )
      },
      ctrl.signal,
    )
      .then(() => {
        setTurns((prev) =>
          prev.map((t) =>
            t.id === last.id ? { ...t, isScoringStreaming: false, phase: 'done' } : t,
          ),
        )
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setTurns((prev) =>
            prev.map((t) =>
              t.id === last.id ? { ...t, isScoringStreaming: false, phase: 'done' } : t,
            ),
          )
        }
      })
  }, [turns, context, stopMic])

  // ── Play TTS ──────────────────────────────────────────────────────────────
  const playTTS = useCallback(async (text: string) => {
    if (!isTTSEnabled || !text.trim()) return
    // stop any previous audio
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (currentObjectUrl.current) {
      URL.revokeObjectURL(currentObjectUrl.current)
      currentObjectUrl.current = null
    }
    try {
      setTTSPlaying(true)
      const url = await fetchTTSAudio(text)
      currentObjectUrl.current = url
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setTTSPlaying(false)
        URL.revokeObjectURL(url)
        currentObjectUrl.current = null
      }
      audio.onerror = () => setTTSPlaying(false)
      await audio.play()
    } catch {
      setTTSPlaying(false)
    }
  }, [isTTSEnabled])

  // ── Generate next question ────────────────────────────────────────────────
  const generateQuestion = useCallback(
    async (currentTurns: MockTurn[]) => {
      const newId = `mock-${Date.now()}`
      const newTurn: MockTurn = {
        id: newId,
        index: currentTurns.length + 1,
        question: '',
        suggestion: '',
        isSuggestionStreaming: false,
        userTranscript: '',
        userAnswer: '',
        score: '',
        isScoringStreaming: false,
        phase: 'asking',
      }
      setTurns((prev) => [...prev, newTurn])

      const history = currentTurns
        .filter((t) => t.phase === 'done')
        .map((t) => ({ question: t.question, answer: t.userAnswer || t.suggestion }))

      const ctrl = new AbortController()
      abortRef.current = ctrl

      // Stream the question
      let fullQuestion = ''
      try {
        await streamCompletion(
          '(generate question)', // placeholder transcript
          context,
          'interviewer',
          (chunk) => {
            fullQuestion += chunk
            setTurns((prev) =>
              prev.map((t) => t.id === newId ? { ...t, question: fullQuestion } : t),
            )
          },
          ctrl.signal,
          undefined,
          history,
        )
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setTurns((prev) =>
          prev.map((t) =>
            t.id === newId ? { ...t, question: '(Error generating question)', phase: 'listening' } : t,
          ),
        )
        return
      }

      // Transition to suggesting + TTS (parallel)
      setTurns((prev) =>
        prev.map((t) =>
          t.id === newId ? { ...t, phase: 'suggesting', isSuggestionStreaming: true } : t,
        ),
      )

      // Play TTS in parallel (don't await — let it run)
      playTTS(fullQuestion)

      // Stream the suggestion
      let fullSuggestion = ''
      const suggestCtrl = new AbortController()
      try {
        await streamCompletion(
          fullQuestion,
          context,
          'copilot',
          (chunk) => {
            fullSuggestion += chunk
            setTurns((prev) =>
              prev.map((t) =>
                t.id === newId ? { ...t, suggestion: fullSuggestion } : t,
              ),
            )
          },
          suggestCtrl.signal,
          undefined,
          history,
        )
      } catch { /* ignore */ }

      setTurns((prev) =>
        prev.map((t) =>
          t.id === newId
            ? { ...t, isSuggestionStreaming: false, phase: 'listening' }
            : t,
        ),
      )
    },
    [context, playTTS],
  )

  // ── Start session ─────────────────────────────────────────────────────────
  const handleStart = useCallback(() => {
    setSessionActive(true)
    setTurns([])
    generateQuestion([])
  }, [generateQuestion])

  // ── Reset session ─────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    abortRef.current?.abort()
    stopMic()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setSessionActive(false)
    setTurns([])
    setTTSPlaying(false)
  }, [stopMic])

  // ── Mic toggle for current turn ───────────────────────────────────────────
  const handleMicToggle = useCallback(() => {
    const last = turns[turns.length - 1]
    if (!last || last.phase !== 'listening') return

    setTurns((prev) =>
      prev.map((t) => t.id === last.id ? { ...t, phase: 'recording' } : t),
    )
    startMic()
  }, [turns, startMic])

  const handleStopRecording = useCallback(() => {
    stopMic()
    // Finalize whatever we have
    setTurns((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.phase !== 'recording') return prev
      const answer = last.userTranscript.trim()
      if (!answer) {
        // nothing spoken yet — go back to listening
        return prev.map((t) => t.id === last.id ? { ...t, phase: 'listening' } : t)
      }
      return prev.map((t) =>
        t.id === last.id
          ? { ...t, userAnswer: answer, phase: 'scoring' as MockTurnPhase }
          : t,
      )
    })
  }, [stopMic])

  // ── Next question ─────────────────────────────────────────────────────────
  const handleNext = useCallback(() => {
    const last = turns[turns.length - 1]
    if (!last || last.phase !== 'done') return
    generateQuestion(turns)
  }, [turns, generateQuestion])

  // ── Derived state ─────────────────────────────────────────────────────────
  const lastTurn = turns[turns.length - 1]
  const canRecord = lastTurn?.phase === 'listening'
  const canStop = lastTurn?.phase === 'recording'
  const canNext = lastTurn?.phase === 'done'
  const isGenerating = lastTurn?.phase === 'asking' || lastTurn?.phase === 'suggesting'

  return (
    <div className="flex flex-col gap-4 min-h-[560px]">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-semibold text-slate-700">Mock Interview</span>
          {sessionActive && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* TTS toggle */}
          <button
            onClick={() => setIsTTSEnabled((v) => !v)}
            title={isTTSEnabled ? 'Mute AI voice' : 'Enable AI voice'}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors text-slate-500"
          >
            {isTTSEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          {sessionActive && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-rose-600 transition-colors px-2 py-1 rounded-lg border border-slate-200 hover:border-rose-200"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
        </div>
      </div>

      {/* TTS indicator */}
      {ttsPlaying && (
        <div className="flex items-center gap-2 text-[10px] text-indigo-500 font-semibold">
          <span className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-0.5 h-3 bg-indigo-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 100}ms` }}
              />
            ))}
          </span>
          AI speaking...
        </div>
      )}

      {/* Session turns */}
      {sessionActive ? (
        <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[520px] pr-1">
          {turns.map((turn, i) => (
            <TurnCard key={turn.id} turn={turn} isLatest={i === turns.length - 1} />
          ))}
          <div ref={bottomRef} />
        </div>
      ) : (
        /* Start screen */
        <div className="flex flex-col items-center justify-center flex-1 gap-5 py-8 text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <BrainCircuit className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="space-y-1.5 max-w-xs">
            <h3 className="text-base font-bold text-slate-800">Practice Makes Perfect</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              AI will ask you interview questions (with voice), show suggested answers, and score your spoken responses.
            </p>
          </div>
          <div className="flex flex-col gap-2 text-xs text-slate-500 bg-slate-50/70 border border-slate-200/60 rounded-xl p-3 w-full max-w-xs text-left">
            <div className="flex items-center gap-2"><span>🤖</span><span>AI asks question (text + voice)</span></div>
            <div className="flex items-center gap-2"><span>💡</span><span>Suggestion hint appears immediately</span></div>
            <div className="flex items-center gap-2"><span>🎙</span><span>You speak your answer via mic</span></div>
            <div className="flex items-center gap-2"><span>📊</span><span>AI scores and gives feedback</span></div>
          </div>
        </div>
      )}

      {/* Bottom action bar */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
        {!sessionActive ? (
          <button
            onClick={handleStart}
            className={cn(
              'w-full py-3 rounded-xl font-bold text-white text-sm cursor-pointer',
              'bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600',
              'hover:from-indigo-500 hover:via-indigo-600 hover:to-cyan-500',
              'transition-all duration-200 flex items-center justify-center gap-2',
              'shadow-lg shadow-indigo-600/25',
            )}
          >
            <BrainCircuit className="w-4 h-4" />
            Start Mock Interview
          </button>
        ) : (
          <>
            {/* Mic button */}
            <div className="flex-1">
              {canRecord && (
                <button
                  onClick={handleMicToggle}
                  className={cn(
                    'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer',
                    'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25',
                  )}
                >
                  <Mic className="w-4 h-4" />
                  Answer (mic)
                </button>
              )}
              {canStop && (
                <button
                  onClick={handleStopRecording}
                  className={cn(
                    'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer',
                    'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 animate-pulse',
                  )}
                >
                  <MicOff className="w-4 h-4" />
                  Stop Recording
                </button>
              )}
              {(isGenerating || lastTurn?.phase === 'scoring') && (
                <div className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-400 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isGenerating ? 'AI is preparing...' : 'Scoring your answer...'}
                </div>
              )}
            </div>

            {/* Next question */}
            {canNext && (
              <button
                onClick={handleNext}
                className={cn(
                  'py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center gap-1.5 transition-all duration-200 cursor-pointer',
                  'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md',
                )}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
