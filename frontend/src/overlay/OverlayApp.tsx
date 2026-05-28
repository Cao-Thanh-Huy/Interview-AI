import { useState, useCallback, useEffect, useRef, CSSProperties } from 'react'
import { useDeepgram } from '@/hooks/useDeepgram'
import { streamCompletion } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionData {
  context: string
  sessionId: string
}

interface Turn {
  id: string
  question: string
  bullets: string[]
  isGenerating: boolean
}

declare global {
  interface Window {
    electronOverlay?: {
      onInit:         (cb: (data: SessionData) => void) => () => void
      stop:           () => void
      setInteractive: (interactive: boolean) => void
      resizeWidth:    (w: number) => void
      dragStart:      () => void
      dragEnd:        () => void
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
function TurnCard({ turn, isLatest }: { turn: Turn; isLatest: boolean }) {
  return (
    <div className={`hub-turn${isLatest ? ' hub-turn--latest' : ''}`}>
      {/* Question */}
      <div className="hub-q">{turn.question}</div>

      {/* Bullets or generating skeleton */}
      {turn.isGenerating && turn.bullets.length === 0 ? (
        <div className="hub-thinking-inline">
          <span className="thinking-dot" />
          Analyzing…
        </div>
      ) : (
        <div className="hub-bullets">
          {turn.bullets.map((b, i) => (
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
      const cleanup = window.electronOverlay.onInit((data) => {
        setSessionData(data)
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
    if (!sessionData) return
    start()
    return () => stop()
  }, [sessionData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stop ───────────────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    stop()
    window.electronOverlay?.stop()
  }, [stop])

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

  // ── Resize handle (right edge — width) ───────────────────────────────────
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.electronOverlay?.setInteractive(true)

    const startX = e.clientX
    const startW = hubWidthRef.current

    const onMove = (mv: MouseEvent) => {
      const newW = Math.min(720, Math.max(260, startW + (mv.clientX - startX)))
      setHubWidth(newW)
      hubWidthRef.current = newW
      window.electronOverlay?.resizeWidth(newW)
    }
    const onUp = () => {
      localStorage.setItem('hub-width', String(hubWidthRef.current))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [])

  // ── Resize handle (bottom edge — height) ───────────────────────────────────
  const handleBottomResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    window.electronOverlay?.setInteractive(true)

    const startY = e.clientY
    const startH = hubHeightRef.current

    const onMove = (mv: MouseEvent) => {
      const newH = Math.min(550, Math.max(120, startH + (mv.clientY - startY)))
      setHubHeight(newH)
      hubHeightRef.current = newH
    }
    const onUp = () => {
      localStorage.setItem('hub-height', String(hubHeightRef.current))
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
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

  if (!isActive) return null

  const hasContent = turns.length > 0 || interimText

  return (
    <div
      className={`overlay-container visible${hubTheme === 'light' ? ' hub-theme--light' : ''}`}
      style={{
        width: hubWidth,
        maxHeight: hubHeight,
        '--hub-bg-alpha': hubOpacity,
        '--font-size': `${fontSize}px`,
      } as CSSProperties}
      onMouseEnter={() => window.electronOverlay?.setInteractive(true)}
      onMouseLeave={() => window.electronOverlay?.setInteractive(false)}
    >
      {/* ── Resize handle — right edge, 14px wide ─────────────────────────── */}
      <div className="resize-handle" onMouseDown={handleResizeMouseDown}>
        <div className="resize-grip" />
      </div>

      {/* ── Top drag bar — prominent, always visible ────────────────────── */}
      <div className="drag-bar" onMouseDown={handleDragMouseDown}>
        <div className="drag-bar__dots">
          <span /><span /><span /><span /><span /><span />
        </div>

        {/* Status indicator */}
        <div className="drag-bar__status">
          <span className={`status-dot ${status === 'connected' ? 'live' : 'dim'}`} />
          {status === 'connected' && <AudioBars level={audioLevel} />}
          <span className="drag-bar__label">
            {status === 'connected' ? 'Live' : 'Connecting…'}
          </span>
        </div>

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
          <div className="action-sep" />
          <button className="icon-btn icon-btn--lg stop" onClick={handleStop} title="Stop session">■</button>
        </div>
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
            />
          ))}

          {/* Live interim caption (speech being spoken right now) */}
          {interimText && (
            <div className="hub-interim">
              <span className="hub-interim__cursor" />
              {interimText}
            </div>
          )}
        </div>
      )}

      {/* ── Empty state: waiting for speech ───────────────────────────────── */}
      {!hasContent && (
        <div className="hub-empty">
          {status === 'connected' ? 'Listening…' : 'Connecting…'}
        </div>
      )}

      {/* ── Bottom resize handle — drag up/down to resize height ───────────── */}
      <div className="resize-handle-bottom" onMouseDown={handleBottomResizeMouseDown}>
        <div className="resize-grip-h" />
      </div>
    </div>
  )
}
