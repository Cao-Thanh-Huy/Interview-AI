import { useState, useCallback, useEffect, useRef, memo, CSSProperties } from 'react'
import { useDeepgram } from '@/hooks/useDeepgram'
import { useAudioCapture } from '@/hooks/useAudioCapture'
import { SessionManager, type SessionState } from '@/lib/SessionManager'
import { streamCompletion, completeOnce, translateText, practiceTurn, getLastTranslateModel, fetchTTSAudio } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionData {
  context: string
  sessionId: string
  mode?: 'live' | 'practice'
  prompt?: string
}

interface Turn {
  id: string
  question: string
  questionTranslation?: string
  bullets: string[]
  bulletTranslation?: string[]  // Vietnamese version of bullets
  isGenerating: boolean
}

declare global {
  interface Window {
    electronOverlay?: {
      onInit:         (cb: (data: SessionData) => void) => () => void
      stop:           () => void
      setInteractive: (interactive: boolean) => void
      resizeWidth:    (w: number) => void
      resizeHeight:   (h: number) => void
      dragStart:      () => void
      dragEnd:        () => void
      stopComplete?:  () => void
      onWindowResized?: (cb: (w: number) => void) => () => void
    }
    electronAudio?: {
      getDesktopSourceId: () => Promise<string | null>
    }
  }
}

// ─── Audio bars ───────────────────────────────────────────────────────────────
function AudioBars({ level }: { level: number }) {
  return (
    <div className="audio-bars">
      {[4, 14, 28, 48, 70].map((t, i) => (
        <span key={i} className="audio-bar" style={{
          height: `${(i + 1) * 3 + 2}px`,
          background: level > t ? '#22c55e' : 'rgba(255,255,255,0.10)',
        }} />
      ))}
    </div>
  )
}

// ─── Single turn card ─────────────────────────────────────────────────────────
const TurnCard = memo(function TurnCard({ turn, isLatest, onTranslateBullets }: { turn: Turn; isLatest: boolean; onTranslateBullets: (id: string) => void }) {
  const [showVietnamese, setShowVietnamese] = useState(false)

  const handleToggle = useCallback(() => {
    if (!showVietnamese && !turn.bulletTranslation) {
      onTranslateBullets(turn.id)
    }
    setShowVietnamese(v => !v)
  }, [showVietnamese, turn.bulletTranslation, turn.id, onTranslateBullets])

  const displayBullets = showVietnamese && turn.bulletTranslation ? turn.bulletTranslation : turn.bullets

  return (
    <div className={`hub-turn${isLatest ? ' hub-turn--latest' : ''}`}>
      {/* Question — same size as bullets, scales with A-/A+ */}
      <div className="hub-q">{turn.question}</div>

      {/* Question translation — 2px smaller than question, scales with A-/A+ */}
      {turn.questionTranslation && (
        <div className="hub-q-translation" style={{ fontSize: 'calc(var(--font-size, 13px) - 2px)', fontStyle: 'italic', marginBottom: 4, paddingLeft: 2 }}>
          🇻🇳 {turn.questionTranslation}
        </div>
      )}

      {/* Bullets or generating skeleton */}
      {turn.isGenerating && turn.bullets.length === 0 ? (
        <div className="hub-thinking-inline">
          <span className="thinking-dot" />
          Analyzing…
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* Translate toggle — top-right corner, icon only with tooltip */}
          {!turn.isGenerating && turn.bullets.length > 0 && (
            <button
              onClick={handleToggle}
              style={{
                position: 'absolute', top: 0, right: 0,
                padding: '3px 5px',
                borderRadius: 4,
                border: '1px solid',
                borderColor: showVietnamese ? 'rgba(99,102,241,0.7)' : 'rgba(255,255,255,0.18)',
                background: showVietnamese ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                color: showVietnamese ? '#a5b4fc' : 'rgba(255,255,255,0.55)',
                cursor: 'pointer',
                display: 'flex', alignItems: 'center',
                lineHeight: 1,
              }}
              title={showVietnamese ? 'Xem tiếng Anh' : 'Dịch sang tiếng Việt'}
            >
              {/* Languages icon — icon only, no label */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 8 6 6" /><path d="m4 14 6-6 2-3" /><path d="M2 5h12" /><path d="M7 2h1" />
                <path d="m22 22-5-10-5 10" /><path d="M14 18h6" />
              </svg>
            </button>
          )}
          <div className="hub-bullets" style={{ paddingRight: !turn.isGenerating && turn.bullets.length > 0 ? 28 : 0 }}>
            {displayBullets.map((b, i) => (
              <div key={i} className="hub-bullet" style={{ animationDelay: `${i * 50}ms` }}>
                <span className="bullet-dot">•</span>
                <span className="bullet-text">{b}</span>
              </div>
            ))}
            {turn.isGenerating && (
              <div className="hub-bullet hub-bullet--streaming">
                <span className="bullet-dot" style={{ opacity: 0.4 }}>•</span>
                <span className="streaming-cursor" />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})

// ─── Main Overlay App ─────────────────────────────────────────────────────────
export function OverlayApp() {
  const [turns, setTurns]           = useState<Turn[]>([])
  // interimText removed — question updates real-time on turn card
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [isActive, setIsActive]     = useState(false) // whether session is running

  // Practice mode
  const [mode, setMode]             = useState<'live' | 'practice'>('live')
  const [practicePrompt, setPracticePrompt] = useState('')
  const [practiceStarted, setPracticeStarted] = useState(false)
  const [practiceError, setPracticeError]     = useState('')
  const [practiceContext, setPracticeContext]   = useState('')
  const [practiceSessionId, setPracticeSessionId] = useState('')
  const [activeModels, setActiveModels] = useState({ question: '70B', summary: '70B', translate: '70B' })
  const [manualInput, setManualInput] = useState('')
  const [manualError, setManualError] = useState('')

  // Font size — +/- buttons in bar, persist to localStorage
  const [fontSize, setFontSize] = useState(() => {
    const v = Number(localStorage.getItem('hub-font'))
    return (v >= 10 && v <= 20) ? v : 13
  })

  // Opacity — ◐− ◐+ buttons in bar, persist to localStorage
  const [hubOpacity, setHubOpacity] = useState(() => {
    const v = Number(localStorage.getItem('hub-opacity'))
    return (v >= 0.2 && v <= 1.0) ? v : 0.93
  })

  // Theme — dark / light toggle, persist to localStorage
  const [hubTheme, setHubTheme] = useState<'dark' | 'light'>(() =>
    (localStorage.getItem('hub-theme') === 'light') ? 'light' : 'dark'
  )

  // Width — resize handle, persist to localStorage
  const [hubWidth, setHubWidth] = useState(() => {
    const v = Number(localStorage.getItem('hub-width'))
    return (v >= 260 && v <= 720) ? v : 440
  })

  // Height — bottom resize handle, persist to localStorage
  const [hubHeight, setHubHeight] = useState(() => {
    const v = Number(localStorage.getItem('hub-height'))
    return (v >= 120 && v <= 550) ? v : 340
  })

  // ── TTS state — speak questions aloud in practice mode ─────────────────────
  const [ttsEnabled, setTtsEnabled] = useState(() => localStorage.getItem('hub-tts') !== 'false')
  const [ttsVoice, setTtsVoice] = useState(() => localStorage.getItem('hub-tts-voice') || 'aura-asteria-en')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const abortRef       = useRef<AbortController | null>(null)
  const streamBuffer   = useRef('')
  const activeTurnId   = useRef<string | null>(null)
  const feedRef        = useRef<HTMLDivElement>(null)
  const hubWidthRef    = useRef(hubWidth)
  const hubHeightRef   = useRef(hubHeight)
  const turnsRef       = useRef(turns)
  const lastTranscriptRef = useRef(0)  // debounce interim transcript
  const userHasScrolledUpRef = useRef(false)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const turnVersionRef = useRef<Record<string, number>>({}) // per-turn revision counter

  // ── Session management refs (giữ sessionId qua các lần restart) ─────────────
  const sessionIdRef = useRef({ live: '', practice: '' })
  const sessionDataRef = useRef<SessionData | null>(null)
  const manualStopRef = useRef(false) // guard chống double-stop từ cleanup

  // ── Generation ID: chống stale completion ─────────────────────────────────
  const generationIdRef = useRef(0)

  // ── Audio capture (persistent) ──────────────────────────────────────────
  const { stream, audioLevel } = useAudioCapture()
  // useDeepgram moved below (cần handleTranscript/handleUtteranceEnd defined trước)

  // ── SessionManager: state machine ─────────────────────────────────────────
  const sessionManagerRef = useRef(new SessionManager())
  const [sessionState, setSessionState] = useState<SessionState>('idle')
  useEffect(() => sessionManagerRef.current.onStateChange(setSessionState), [])

  // Keep refs in sync
  sessionDataRef.current = sessionData  // sync mỗi render — dùng trong callbacks stable
  useEffect(() => { hubWidthRef.current  = hubWidth  }, [hubWidth])
  useEffect(() => { hubHeightRef.current = hubHeight }, [hubHeight])
  turnsRef.current = turns  // sync every render (no deps — runs every render)

  // ── Auto-scroll feed to bottom on new content (rAF-batched) ──────────────
  //     If user scrolled up manually, pause auto-scroll + show ↓ button
  const scrollRafRef = useRef<number | null>(null)
  useEffect(() => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)

    // User đã scroll lên — không auto-scroll, hiện nút ↓ để họ chủ động quay lại
    if (userHasScrolledUpRef.current) {
      setShowScrollButton(true)
      return
    }

    scrollRafRef.current = requestAnimationFrame(() => {
      if (feedRef.current) {
        feedRef.current.scrollTop = feedRef.current.scrollHeight
      }
    })
    return () => { if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current) }
  }, [turns])

  // ── Add or update a turn ───────────────────────────────────────────────────
  const addTurn = useCallback((question: string): string => {
    const id = Date.now().toString()
    activeTurnId.current = id
    turnVersionRef.current[id] = 0  // init counter cho turn mới
    setTurns(prev => [...prev, { id, question, bullets: [], isGenerating: true }].slice(-10))
    return id
  }, [])

  const updateTurnQuestion = useCallback((id: string, question: string) => {
    setTurns(prev => prev.map(t => t.id === id ? { ...t, question } : t))
  }, [])

  const appendBullet = useCallback((id: string, bullet: string) => {
    setTurns(prev => prev.map(t =>
      t.id === id ? { ...t, bullets: [...t.bullets, bullet] } : t
    ))
  }, [])

  const finalizeTurn = useCallback((id: string) => {
    setTurns(prev => prev.map(t =>
      t.id === id ? { ...t, isGenerating: false } : t
    ))
  }, [])

  const translateBullets = useCallback((id: string) => {
    const turn = turnsRef.current.find(t => t.id === id)
    if (!turn || turn.bulletTranslation) return
    const fullText = turn.bullets.join('\n')
    translateText(fullText)
      .then((vn) => {
        const lines = vn.split('\n').map(l => l.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '')).filter(Boolean)
        setTurns(prev => prev.map(t => t.id === id ? { ...t, bulletTranslation: lines } : t))
      })
      .catch(() => {})
  }, [])

  // ── Transcript handler — STABLE callback (đọc sessionData từ ref) ─────────
  const handleTranscript = useCallback((text: string, isFinal?: boolean) => {
    if (!text.trim()) return
    if (!sessionDataRef.current) {
      console.log('[Transcript] blocked: sessionDataRef null, activeTurnId=', activeTurnId.current, 'isFinal=', isFinal)
      return  // session stopped, ignore
    }

    const sid = sessionIdRef.current.live
    const ctx = sessionDataRef.current.context ?? ''
    if (isFinal) console.log('[Transcript] isFinal activeTurnId=', activeTurnId.current, 'sid=', sid)

    // Luôn tạo/cập nhật turn — không return sớm (fix interim bug)
    let id = activeTurnId.current
    if (!id) {
      const activeIds = new Set(turnsRef.current.slice(-20).map(t => t.id))
      Object.keys(turnVersionRef.current).forEach(k => {
        if (!activeIds.has(k)) delete turnVersionRef.current[k]
      })
      id = addTurn(text)
    } else {
      // Update question — interim: debounce 150ms để tránh re-render quá nhiều
      if (isFinal) {
        updateTurnQuestion(id, text)
        lastTranscriptRef.current = Date.now()
      } else {
        const now = Date.now()
        if (now - lastTranscriptRef.current >= 150) {
          updateTurnQuestion(id, text)
          lastTranscriptRef.current = now
        }
      }
    }

    if (isFinal) {
      const genId = ++generationIdRef.current
      const myVersion = (turnVersionRef.current[id] ?? 0) + 1
      turnVersionRef.current[id] = myVersion
      const staleCheck = () => turnVersionRef.current[id] !== myVersion || generationIdRef.current !== genId

      // Translate the FINAL full question
      translateText(text)
        .then((vn) => {
          if (staleCheck()) return
          setActiveModels(prev => ({ ...prev, translate: getLastTranslateModel() }))
          setTurns(prev => prev.map(t => t.id === id ? { ...t, questionTranslation: vn } : t))
        })
        .catch(() => {})

      // Abort previous completion dể tránh connection storm + rate limit
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      if (myVersion === 1) {
        // ── isFinal #1: STREAM real-time ──
        streamBuffer.current = ''
        streamCompletion(
          text, ctx, 'copilot',
          (chunk) => {
            if (staleCheck()) return

            streamBuffer.current += chunk
            const lines = streamBuffer.current.split('\n')
            streamBuffer.current = lines.pop() ?? ''
            lines
              .map(l => l.replace(/^[\s-\*\d\.]+/, '').trim())
              .filter(Boolean)
              .forEach(b => appendBullet(id, b))
          },
          controller.signal, // Abort nếu có isFinal mới hon
          sid,
          [],
        )
        .then(() => {
          if (staleCheck()) return
          const rem = streamBuffer.current.replace(/^[\s-\*\d\.]+/, '').trim()
          if (rem) appendBullet(id, rem)
        })
        .catch((err) => {
          if (err?.name === 'AbortError') return
          console.error('[Overlay] streamCompletion error:', err)
        })
      } else {
        // ── isFinal #2+: NON-STREAMING, atomic replace ──
        completeOnce(text, ctx, 'copilot', sid, [], controller.signal)
          .then((fullAnswer) => {
            if (staleCheck()) return

            const bullets = fullAnswer
              .split('\n')
              .map(l => l.replace(/^[\s-\*\d\.]+/, '').trim())
              .filter(Boolean)

            if (bullets.length > 0) {
              setTurns(prev => prev.map(t => t.id === id ? { ...t, bullets } : t))
            }
          })
          .catch((err) => {
            if (err?.name === 'AbortError') return
            console.error('[Overlay] completeOnce error:', err)
          })
      }
    }
  }, [addTurn, updateTurnQuestion, appendBullet]) // STABLE — không phụ thuộc sessionData

  // ── UtteranceEnd → create turn + stream AI response ───────────────────────
  const handleUtteranceEnd = useCallback((fullText: string) => {
    if (!fullText.trim()) return

    const id = activeTurnId.current
    if (id) {
      finalizeTurn(id)
    }

    activeTurnId.current = null
  }, [finalizeTurn])

  // ── Deepgram (per session) — phải đặt sau handleTranscript/handleUtteranceEnd ──
  const { start, stop, status, closeWasClean } = useDeepgram({
    stream,
    onTranscript:   handleTranscript,
    onUtteranceEnd: handleUtteranceEnd,
    onStatusChange: (s) => {
      if (s === 'connected') sessionManagerRef.current.transition({ type: 'LISTENING' })
      else if (s === 'error') sessionManagerRef.current.transition({ type: 'ERROR', message: '' })
    },
    onError:        (e) => console.error('[Overlay]', e),
  })

  // keep ref fresh for reconnect effect
  const startRef = useRef(start)
  startRef.current = start

  // ── Manual question input — type a question, get AI suggestion ──────────────
  //     Non-streaming, không gửi sessionId → backend skip persist + summary.
  //     Mỗi turn có ID riêng → không conflict với live flow.
  const handleManualSubmit = useCallback(async () => {
    const text = manualInput.trim()
    if (!text) return

    setManualInput('')
    setManualError('')

    // Tạo turn manual trực tiếp — KHÔNG addTurn (addTurn ghi đè activeTurnId + suggestionCountRef)
    const manualId = Date.now().toString() + '-m'
    setTurns(prev => [...prev, {
      id: manualId, question: text, bullets: [], isGenerating: true,
    }].slice(-10))

    // Dịch câu hỏi background — không gây block
    translateText(text)
      .then((vn) => {
        setActiveModels(prev => ({ ...prev, translate: getLastTranslateModel() }))
        setTurns(prev => prev.map(t => t.id === manualId ? { ...t, questionTranslation: vn } : t))
      })
      .catch(() => {})

    const ctx = sessionData?.context ?? ''

    try {
      // Non-streaming: gửi sessionId để lưu vào history
      const answer = await completeOnce(text, ctx, 'copilot', sessionIdRef.current.live, [])
      if (answer) {
        // Parse answer thành bullets, set atomic 1 lần
        const bullets = answer
          .split('\n')
          .map(l => l.replace(/^[\s•\-\*\d\.]+/, '').trim())
          .filter(Boolean)
        if (bullets.length > 0) {
          setTurns(prev => prev.map(t => t.id === manualId ? { ...t, bullets } : t))
        }
      }
    } catch (err: any) {
      setManualError(err?.message || 'Request failed')
    } finally {
      finalizeTurn(manualId)
    }
  }, [manualInput, sessionData, finalizeTurn])

  // ── TTS: speak text aloud ──────────────────────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    if (!ttsEnabled || !text.trim()) return

    // Stop any current playback
    audioRef.current?.pause()
    audioRef.current = null

    // Don't speak error messages
    if (text.startsWith('⚠️')) return

    try {
      setIsSpeaking(true)
      const audioUrl = await fetchTTSAudio(text.trim(), ttsVoice)
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }
      audio.onerror = () => {
        setIsSpeaking(false)
        URL.revokeObjectURL(audioUrl)
      }

      await audio.play()
    } catch (err) {
      console.error('[TTS] Failed to speak:', err)
      setIsSpeaking(false)
    }
  }, [ttsEnabled, ttsVoice])

  const toggleTts = useCallback(() => {
    setTtsEnabled(prev => {
      const next = !prev
      localStorage.setItem('hub-tts', String(next))
      if (!next) {
        // Stop speaking immediately when turning off
        audioRef.current?.pause()
        audioRef.current = null
        setIsSpeaking(false)
      }
      return next
    })
  }, [])

  // ── Practice turn — AI tự hỏi + gợi ý ──────────────────────────────────────
  const handlePracticeTurn = useCallback(async (action: 'start' | 'next') => {
    if (!practicePrompt) return

    // Stop any ongoing speech before starting new turn
    audioRef.current?.pause()
    audioRef.current = null
    setIsSpeaking(false)

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    // Placeholder turn: empty question, show spinner
    const id = Date.now().toString()
    activeTurnId.current = id
    setPracticeError('')
    setTurns(prev => [...prev, { id, question: '', bullets: [], isGenerating: true }].slice(-10))

    try {
      const result = await practiceTurn(practicePrompt, action, practiceContext, practiceSessionId)

      // Update active models
      if (result.questionModel || result.suggestionModel) {
        setActiveModels(prev => ({
          ...prev,
          question: result.questionModel || prev.question,
          summary: result.suggestionModel || prev.summary,
        }))
      }

      // Set question
      setTurns(prev => prev.map(t => t.id === id ? { ...t, question: result.question } : t))

      // TTS: speak the question aloud
      speakText(result.question)

      // Auto-translate question
      translateText(result.question)
        .then((vn) => {
          setActiveModels(prev => ({ ...prev, translate: getLastTranslateModel() }))
          setTurns(prev => prev.map(t => t.id === id ? { ...t, questionTranslation: vn } : t))
        })
        .catch(() => {})

      // Parse suggestion into bullets
      if (result.suggestion) {
        const lines = result.suggestion
          .split('\n')
          .map(l => l.trim().replace(/^[-*•]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1'))
          .filter(Boolean)

        lines.forEach(b => appendBullet(id, b))

        // Translate suggestion in background
        translateText(result.suggestion)
          .then((vn) => {
            const vnLines = vn.split('\n')
              .map(l => l.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, ''))
              .filter(Boolean)
            setTurns(prev => prev.map(t => t.id === id ? { ...t, bulletTranslation: vnLines } : t))
          })
          .catch(() => {})
      }

      finalizeTurn(id)
    } catch (err) {
      console.error('[Practice] Error:', err)
      // Show error trong turn thay vì turn rỗng
      setTurns(prev => prev.map(t => t.id === id ? {
        ...t,
        question: '⚠️ Connection failed. Please try again.',
        isGenerating: false,
      } : t))
      setPracticeError(err instanceof Error ? err.message : 'Failed to get response')
    }
  }, [practicePrompt, practiceContext, practiceSessionId, appendBullet])

  // ── IPC: session init (VIẾT LẠI — giữ sessionId qua restart) ──────────────
  useEffect(() => {
    if (window.electronOverlay) {
      const cleanup = window.electronOverlay.onInit((data: SessionData) => {
        if (data.mode === 'practice') {
          sessionIdRef.current.practice ||= data.sessionId || ''
          console.log('[Session] onInit practice sid=', sessionIdRef.current.practice)
          setPracticeSessionId(sessionIdRef.current.practice)
          setMode('practice')
          setPracticePrompt(data.prompt || '')
          setPracticeContext(data.context || '')
          setTurns([])
          setPracticeStarted(false)
        } else {
          const prevLiveId = sessionIdRef.current.live
          // Luôn cập nhật sessionId mới từ backend (session mới = sessionId mới)
          sessionIdRef.current.live = data.sessionId || sessionIdRef.current.live
          const sid = sessionIdRef.current.live
          console.log('[Session] onInit live prevLiveId=', prevLiveId, 'ipcSessionId=', data.sessionId, 'finalSid=', sid, 'isNew=', prevLiveId !== sid)
          setSessionData({ ...data, sessionId: sid })
          setMode('live')
          // KHÔNG clear turns — giữ lại qua restart
        }
        setIsActive(true)
      })
      return cleanup
    } else {
      // Browser dev mode
      setSessionData({ context: '', sessionId: 'dev-' + Date.now() })
      setIsActive(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessionData) {
      console.log('[Session] auto-start SKIP — no sessionData')
      return
    }
    if (mode === 'practice') {
      console.log('[Session] auto-start SKIP — practice mode')
      return  // Practice uses its own turn trigger
    }
    console.log('[Session] auto-start sessionId=', sessionData.sessionId, 'sessionDataRef=', sessionDataRef.current === sessionData)
    sessionManagerRef.current.transition({ type: 'INIT' })
    isStartingRef.current = true
    start().finally(() => { isStartingRef.current = false })
    return () => {
      console.log('[Session] auto-start CLEANUP')
      isStartingRef.current = false
      if (!manualStopRef.current) stop()
    }
  }, [sessionData, stream, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-reconnect với exponential backoff + max retries ─────────────────
  const reconnectAttemptsRef = useRef(0)
  const MAX_RECONNECT_ATTEMPTS = 8
  const isStartingRef = useRef(false)  // ngăn reconnect effect chạy khi auto-start đang chạy
  useEffect(() => {
    if (manualStopRef.current) return
    if (isStartingRef.current) return
    // Nếu WS đóng sạch ko transcript → audio im lặng → reconnect vô ích
    if (closeWasClean) return

    if ((status === 'idle' || status === 'error') && sessionData && mode !== 'practice') {
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.log(`[Overlay] Max reconnect (${MAX_RECONNECT_ATTEMPTS}) reached, giving up`)
        return
      }
      const delay = Math.min(2000 * Math.pow(1.5, reconnectAttemptsRef.current), 30000)
      reconnectAttemptsRef.current++
      console.log(`[Overlay] Reconnect #${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS} in ${Math.round(delay/1000)}s`)
      const timer = setTimeout(() => startRef.current(), delay)
      return () => clearTimeout(timer)
    } else if (status === 'connected') {
      if (reconnectAttemptsRef.current > 0) {
        reconnectAttemptsRef.current = 0
        console.log('[Overlay] Connected — reset retry counter')
      }
    }
  }, [status, sessionData, mode, closeWasClean])

  // ── Practice: trigger first turn once ──────────────────────────────────────
  useEffect(() => {
    if (mode === 'practice' && isActive && !practiceStarted && practicePrompt) {
      setPracticeStarted(true)
      handlePracticeTurn('start')
    }
  }, [mode, isActive, practiceStarted, practicePrompt, handlePracticeTurn])

  // ── Keyboard shortcut: Space → Next (practice mode) ──────────────────────
  useEffect(() => {
    if (mode !== 'practice') return

    const handler = (e: KeyboardEvent) => {
      const t = turnsRef.current
      if (t.length === 0) return
      if (t[t.length - 1].isGenerating) return
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.code === 'Space') {
        e.preventDefault()
        handlePracticeTurn('next')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, handlePracticeTurn])

  // ── Sync Electron window width with stored hubWidth on session start ────
  // Prevents desync where window is created at 440px but hubWidth (from
  // localStorage) is wider, causing right-side elements (stop button) to
  // be clipped by the viewport.
  useEffect(() => {
    if (!isActive) return
    window.electronOverlay?.resizeWidth?.(hubWidth)
  }, [isActive]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync hubWidth with native window resize (OS resize border) ────────────
  useEffect(() => {
    if (!window.electronOverlay?.onWindowResized) return
    const cleanup = window.electronOverlay.onWindowResized((w: number) => {
      const clamped = Math.min(720, Math.max(260, w))
      setHubWidth(clamped)
      hubWidthRef.current = clamped
    })
    return cleanup
  }, [])

  // ── Stop — clear sessionId, reset refs & state ────────────────────────────
  const handleStop = useCallback(() => {
    console.log('[Session] handleStop start liveSid=', sessionIdRef.current.live, 'activeTurnId=', activeTurnId.current, 'mode=', mode)
    manualStopRef.current = true
    sessionManagerRef.current.transition({ type: 'STOP' })
    abortRef.current?.abort()
    stop()
    // Reset refs
    activeTurnId.current = null
    turnVersionRef.current = {}
    lastTranscriptRef.current = 0
    // Finalize các turn đang generating (tránh spinner treo)
    setTurns(prev => prev.map(t => t.isGenerating ? { ...t, isGenerating: false } : t))
    window.electronOverlay?.stop()
    setSessionData(null)
    setIsActive(false)
    setManualInput('')
    setManualError('')
    if (mode === 'practice') {
      setPracticeStarted(false)
      setPracticeError('')
      setPracticeContext('')
    }
    // Clear sessionId để lần start sau nhận được sessionId mới từ backend
    sessionIdRef.current.live = ''
    console.log('[Session] handleStop done — liveSid cleared')
    // Notify main process that stop is complete
    window.electronOverlay?.stopComplete?.()
    // Reset guard để lần start sau có thể auto-start
    manualStopRef.current = false
  }, [stop, mode])

  // ── Font size buttons ──────────────────────────────────────────────────────
  const changeFont = useCallback((delta: number) => {
    setFontSize(prev => {
      const next = Math.min(20, Math.max(10, prev + delta))
      localStorage.setItem('hub-font', String(next))
      return next
    })
  }, [])

  // ── Opacity buttons ─────────────────────────────────────────────────────────
  const changeOpacity = useCallback((delta: number) => {
    setHubOpacity(prev => {
      const next = Math.round(Math.min(1.0, Math.max(0.2, prev + delta)) * 10) / 10
      localStorage.setItem('hub-opacity', String(next))
      return next
    })
  }, [])

  // ── Theme toggle ───────────────────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    setHubTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('hub-theme', next)
      return next
    })
  }, [])

  // ── Resize: Pointer Events + setPointerCapture ─────────────────────────────
  const handleResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    const wrapper = el.closest('.overlay-wrapper') as HTMLElement
    const container = wrapper?.querySelector('.overlay-container') as HTMLElement
    if (!wrapper || !container) return

    el.setPointerCapture(e.pointerId)
    container.style.transition = 'none'

    const startX = e.clientX, startY = e.clientY
    const startW = wrapper.offsetWidth, startH = container.offsetHeight

    const onMove = (mv: PointerEvent) => {
      const newW = Math.min(720, Math.max(260, startW + (mv.clientX - startX)))
      const newH = Math.min(550, Math.max(120, startH + (mv.clientY - startY)))
      wrapper.style.width = `${newW}px`
      container.style.maxHeight = `${newH}px`
      hubWidthRef.current = newW
      hubHeightRef.current = newH
      window.electronOverlay?.resizeWidth(newW)
    }
    const onUp = () => {
      el.releasePointerCapture(e.pointerId)
      container.style.transition = ''
      setHubWidth(hubWidthRef.current)
      setHubHeight(hubHeightRef.current)
      localStorage.setItem('hub-width', String(hubWidthRef.current))
      localStorage.setItem('hub-height', String(hubHeightRef.current))
      window.electronOverlay?.resizeWidth(hubWidthRef.current)
      window.electronOverlay?.resizeHeight(hubHeightRef.current)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
  }, [])

  // ── Drag handle (top bar) ──────────────────────────────────────────────────
  const handleDragMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    window.electronOverlay?.dragStart()

    const onUp = () => {
      window.electronOverlay?.dragEnd()
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mouseup', onUp)
  }, [])

  // ── Smart scroll: detect user-initiated scroll-up ──────────────────────
  const handleFeedScroll = useCallback(() => {
    const el = feedRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    userHasScrolledUpRef.current = !atBottom
    if (atBottom) setShowScrollButton(false)
  }, [])

  const scrollToBottom = useCallback(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
    userHasScrolledUpRef.current = false
    setShowScrollButton(false)
  }, [])

  const hasContent = isActive && turns.length > 0
  const latestTurnIsGenerating = isActive && turns.length > 0 && turns[turns.length - 1].isGenerating

  return (
    <div
      className={`overlay-wrapper${hubTheme === 'light' ? ' hub-theme--light' : ''}${!isActive ? ' overlay-wrapper--idle' : ''}`}
      style={{ width: hubWidth }}
      onMouseEnter={() => window.electronOverlay?.setInteractive(true)}
      onMouseLeave={() => window.electronOverlay?.setInteractive(false)}
    >
      {/* ── Main container (overflow: hidden for transition) ───────────────── */}
      <div
        className="overlay-container visible"
        style={{
          maxHeight: hubHeight,
          '--hub-bg-alpha': hubOpacity,
          '--font-size': `${fontSize}px`,
        } as CSSProperties}
      >
        {/* ── Top drag bar — prominent, always visible ────────────────────── */}
        <div className="drag-bar" onMouseDown={handleDragMouseDown}>
          <div className="drag-bar__dots">
            <span /><span /><span /><span /><span /><span />
          </div>

          {/* Status indicator */}
          {mode === 'practice' ? (
            <div className="drag-bar__status">
              <span className={`status-dot ${isSpeaking ? 'live' : 'dim'}`} />
              <span className="drag-bar__label">
                {latestTurnIsGenerating ? 'Thinking…' : isSpeaking ? 'Speaking… 🔊' : 'Practice'}
              </span>
            </div>
          ) : (
            <div className="drag-bar__status">
              <span className={`status-dot ${status === 'connected' ? 'live' : 'dim'}`} />
              {status === 'connected' && <AudioBars level={audioLevel} />}
              <span className="drag-bar__label">
                {status === 'connected' ? 'Live' : 'Connecting…'}
              </span>
            </div>
          )}

          {/* Right controls: A− A+ | ◑− ◑+ | ☀/☾ | Stop */}
          <div className="drag-bar__actions">
            <button className="icon-btn icon-btn--lg" onClick={() => changeFont(-1)}      title="Smaller text">A−</button>
            <button className="icon-btn icon-btn--lg" onClick={() => changeFont(1)}       title="Larger text">A+</button>
            <div className="action-sep" />
            <button className="icon-btn icon-btn--lg" onClick={() => changeOpacity(-0.1)} title="More transparent">◑−</button>
            <button className="icon-btn icon-btn--lg" onClick={() => changeOpacity(0.1)}  title="More opaque">◑+</button>
            <div className="action-sep" />
            <button className="icon-btn icon-btn--lg" onClick={toggleTheme} title={hubTheme === 'dark' ? 'Switch to light' : 'Switch to dark'}>
              {hubTheme === 'dark' ? '☀' : '☾'}
            </button>
            {/* TTS toggle — only show in practice mode */}
            {mode === 'practice' && (
              <button
                className="icon-btn icon-btn--lg"
                onClick={toggleTts}
                title={ttsEnabled ? 'Mute voice' : 'Enable voice'}
                style={{ color: ttsEnabled ? (isSpeaking ? '#22c55e' : 'rgba(140,155,190,0.55)') : 'rgba(100,115,150,0.35)' }}
              >
                {ttsEnabled ? '🔊' : '🔇'}
              </button>
            )}
            <div className="action-sep" />
            {mode === 'practice' && (
              <button
                onClick={() => handlePracticeTurn('next')}
                disabled={latestTurnIsGenerating}
                style={{
                  padding: '4px 12px', borderRadius: 6,
                  background: latestTurnIsGenerating ? 'transparent' : 'rgba(99,102,241,0.2)',
                  color: latestTurnIsGenerating ? 'rgba(100,115,150,0.45)' : '#a5b4fc',
                  border: latestTurnIsGenerating ? 'none' : '1px solid rgba(99,102,241,0.3)',
                  fontSize: 11, fontWeight: 600, cursor: latestTurnIsGenerating ? 'default' : 'pointer',
                  whiteSpace: 'nowrap', lineHeight: '20px',
                  transition: 'background 140ms',
                  fontFamily: 'inherit',
                }}
                title="Next question (Space)"
              >
                {latestTurnIsGenerating ? '…' : 'Next →'}
              </button>
            )}
            <div className="action-sep" />
            <button className="icon-btn icon-btn--lg stop" onClick={handleStop} title="Stop session">■</button>
          </div>
        </div>

        {/* ── Model status row ──────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '3px 12px', flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          fontSize: 9, color: 'rgba(140,155,190,0.4)',
        }}>
          <span style={{ color: '#22c55e' }}>●</span>
          <span>{activeModels.question}</span>
          <span style={{ color: '#eab308' }}>●</span>
          <span>{activeModels.summary}</span>
          <span style={{ color: '#ef4444' }}>●</span>
          <span>{activeModels.translate}</span>
        </div>

        {/* ── Scrollable turn feed ───────────────────────────────────────────── */}
        {hasContent && (
          <div className="hub-feed" ref={feedRef} onScroll={handleFeedScroll}>
            {/* Past turns */}
            {turns.map((turn, i) => (
              <TurnCard
                key={turn.id}
                turn={turn}
                isLatest={i === turns.length - 1}
                onTranslateBullets={translateBullets}
              />
            ))}

            {/* Practice error */}
            {mode === 'practice' && practiceError && (
              <div style={{
                padding: '8px 12px', margin: '6px 0', borderRadius: 6,
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                color: '#f87171', fontSize: 11, lineHeight: 1.5,
              }}>
                ⚠️ {practiceError}
              </div>
            )}

            {/* Interim caption removed — question updates real-time on turn card */}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!hasContent && (
          <div className="hub-empty">
            {mode === 'practice' ? 'Preparing your first question...' : (status === 'connected' ? 'Listening…' : 'Connecting…')}
          </div>
        )}

        {/* ── Scroll-to-bottom button (floats above input row) ────────────── */}
        {showScrollButton && (
          <button className="hub-scroll-btn" onClick={scrollToBottom} title="Scroll to latest">
            ↓
          </button>
        )}

        {/* ── Manual question input ───────────────────────────────────────────── */}
        {isActive && (
          <div className="hub-input-row">
            <input
              className="hub-input"
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  setManualError('')
                  handleManualSubmit()
                }
              }}
              placeholder={mode === 'practice' ? 'Ask a custom question...' : 'Type a question...'}
              disabled={mode === 'practice' && latestTurnIsGenerating}
            />
            <button
              className="hub-send-btn"
              onClick={() => { setManualError(''); handleManualSubmit() }}
              disabled={!manualInput.trim() || (mode === 'practice' && latestTurnIsGenerating)}
              title="Send"
            >
              ▶
            </button>
          </div>
        )}

        {/* ── Manual error ───────────────────────────────────────────────── */}
        {manualError && (
          <div className="hub-manual-error">{manualError}</div>
        )}

      </div>

      {/* ── Resize handle bottom-right ─────────────────────────────────────── */}
      <div className="resize-handle" onPointerDown={handleResizePointerDown} />
    </div>
  )
}
