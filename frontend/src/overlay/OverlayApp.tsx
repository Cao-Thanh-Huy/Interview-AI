import { useState, useCallback, useEffect, useRef, CSSProperties } from 'react'
import { useDeepgram } from '@/hooks/useDeepgram'
import { streamCompletion, translateText, practiceTurn, getLastTranslateModel, fetchTTSAudio } from '@/lib/api'

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
function TurnCard({ turn, isLatest, onTranslateBullets }: { turn: Turn; isLatest: boolean; onTranslateBullets: (id: string) => void }) {
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
}

// ─── Main Overlay App ─────────────────────────────────────────────────────────
export function OverlayApp() {
  const [turns, setTurns]           = useState<Turn[]>([])
  const [interimText, setInterimText] = useState('')  // live speech being typed
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

  // Keep refs in sync
  useEffect(() => { hubWidthRef.current  = hubWidth  }, [hubWidth])
  useEffect(() => { hubHeightRef.current = hubHeight }, [hubHeight])

  // ── Auto-scroll feed to bottom when new content ────────────────────────────
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [turns])

  // ── Add or update a turn ───────────────────────────────────────────────────
  const addTurn = useCallback((question: string): string => {
    const id = Date.now().toString()
    activeTurnId.current = id
    setTurns(prev => [...prev, { id, question, bullets: [], isGenerating: true }].slice(-10))
    // Translate question in background
    translateText(question)
      .then((vn) => {
        setActiveModels(prev => ({ ...prev, translate: getLastTranslateModel() }))
        setTurns(prev => prev.map(t => t.id === id ? { ...t, questionTranslation: vn } : t))
      })
      .catch(() => {})
    return id
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
    const turn = turns.find(t => t.id === id)
    if (!turn || turn.bulletTranslation) return
    const fullText = turn.bullets.join('\n')
    translateText(fullText)
      .then((vn) => {
        const lines = vn.split('\n').map(l => l.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '')).filter(Boolean)
        setTurns(prev => prev.map(t => t.id === id ? { ...t, bulletTranslation: lines } : t))
      })
      .catch(() => {})
  }, [turns])

  // ── Transcript handler — show live speech ──────────────────────────────────
  const handleTranscript = useCallback((text: string) => {
    if (!text.trim()) return
    setInterimText(text)
  }, [])

  // ── UtteranceEnd → create turn + stream AI response ───────────────────────
  const handleUtteranceEnd = useCallback(async (fullText: string) => {
    if (!fullText.trim()) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setInterimText('')
    const id = addTurn(fullText)

    streamBuffer.current = ''

    const ctx = sessionData?.context ?? ''
    const sid = sessionData?.sessionId

    try {
      await streamCompletion(
        fullText, ctx, 'copilot',
        (chunk) => {
          streamBuffer.current += chunk
          const lines = streamBuffer.current.split('\n')
          streamBuffer.current = lines.pop() ?? ''

          lines
            .map(l => l.replace(/^[\s\u2022\-\*\d\.]+/, '').trim())
            .filter(Boolean)
            .forEach(b => appendBullet(id, b))
        },
        abortRef.current.signal,
        sid,
        [],
      )

      // Flush remaining buffer
      const rem = streamBuffer.current.replace(/^[\s\u2022\-\*\d\.]+/, '').trim()
      if (rem) appendBullet(id, rem)
    } catch {
      // aborted or network error
    } finally {
      finalizeTurn(id)
    }
  }, [sessionData, addTurn, appendBullet, finalizeTurn])

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

  // ── Deepgram ───────────────────────────────────────────────────────────────
  const { start, stop, status, audioLevel } = useDeepgram({
    onTranscript:   handleTranscript,
    onUtteranceEnd: handleUtteranceEnd,
    onStatusChange: () => {},
    onError:        (e) => console.error('[Overlay]', e),
  })

  // ── IPC: session init ──────────────────────────────────────────────────────
  useEffect(() => {
    if (window.electronOverlay) {
      const cleanup = window.electronOverlay.onInit((data: SessionData) => {
        setSessionData(data)
        setIsActive(true)
        if (data.mode === 'practice') {
          setMode('practice')
          setPracticePrompt(data.prompt || '')
          setPracticeContext(data.context || '')
          setPracticeSessionId(data.sessionId || '')
          setTurns([])  // Reset turns for new practice session
          setPracticeStarted(false)
        } else {
          setMode('live')
        }
      })
      return cleanup
    } else {
      // Browser dev mode
      setSessionData({ context: '', sessionId: 'dev-' + Date.now() })
      setIsActive(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sessionData) return
    if (mode === 'practice') return  // Practice uses its own turn trigger
    start()
    return () => stop()
  }, [sessionData, mode]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (turns.length === 0) return
    const isGenerating = turns[turns.length - 1].isGenerating

    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isGenerating) {
        e.preventDefault()
        handlePracticeTurn('next')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [mode, turns, handlePracticeTurn])

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

  // ── Stop ───────────────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    stop()
    window.electronOverlay?.stop()
    if (mode === 'practice') {
      setPracticeStarted(false)
      setMode('live')
      setSessionData(null)  // Prevent Deepgram start on hidden overlay
      setTurns([])
      setPracticeError('')
      setPracticeContext('')
      setPracticeSessionId('')
    }
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

  const hasContent = isActive && (turns.length > 0 || (mode === 'live' && !!interimText))
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
          <div className="hub-feed" ref={feedRef}>
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

            {/* Live interim caption — only in live mode */}
            {mode === 'live' && interimText && (
              <div className="hub-interim">
                <span className="hub-interim__cursor" />
                {interimText}
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────────── */}
        {!hasContent && (
          <div className="hub-empty">
            {mode === 'practice' ? 'Preparing your first question...' : (status === 'connected' ? 'Listening…' : 'Connecting…')}
          </div>
        )}

      </div>

      {/* ── Resize handle bottom-right ─────────────────────────────────────── */}
      <div className="resize-handle" onPointerDown={handleResizePointerDown} />
    </div>
  )
}
