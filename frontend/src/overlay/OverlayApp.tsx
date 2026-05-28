import { useState, useCallback, useEffect, useRef } from 'react'
import { useDeepgram } from '@/hooks/useDeepgram'
import { streamCompletion } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
type OverlayState = 'idle' | 'listening' | 'thinking' | 'answer'

interface SessionData {
  context: string
  sessionId: string
}

// Window augmentation for Electron IPC bridges
declare global {
  interface Window {
    electronOverlay?: {
      onInit: (cb: (data: SessionData) => void) => () => void
      stop: () => void
      setInteractive: (interactive: boolean) => void
    }
    electronAudio?: {
      getDesktopSourceId: () => Promise<string | null>
    }
  }
}

// ─── Audio level bars ─────────────────────────────────────────────────────────
function AudioBars({ level }: { level: number }) {
  // 5 bars at increasing height thresholds
  const thresholds = [4, 14, 28, 48, 70]
  return (
    <div className="audio-bars">
      {thresholds.map((t, i) => (
        <span
          key={i}
          className="audio-bar"
          style={{
            height: `${(i + 1) * 3 + 2}px`,
            background: level > t ? '#22c55e' : 'rgba(255,255,255,0.10)',
          }}
        />
      ))}
    </div>
  )
}

// ─── Main Overlay App ─────────────────────────────────────────────────────────
export function OverlayApp() {
  const [overlayState, setOverlayState] = useState<OverlayState>('idle')
  const [transcript, setTranscript]     = useState('')
  const [bullets, setBullets]           = useState<string[]>([])
  const [sessionData, setSessionData]   = useState<SessionData | null>(null)

  const abortRef         = useRef<AbortController | null>(null)
  const collapseTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamBuffer     = useRef('')
  const bulletCountRef   = useRef(0)

  // ── Auto-collapse after answer has been read (8s) ──────────────────────────
  const clearCollapse = () => {
    if (collapseTimer.current) { clearTimeout(collapseTimer.current); collapseTimer.current = null }
  }
  const scheduleCollapse = useCallback(() => {
    clearCollapse()
    collapseTimer.current = setTimeout(() => {
      setOverlayState('listening')
      setBullets([])
      bulletCountRef.current = 0
      streamBuffer.current = ''
    }, 8000)
  }, [])

  // ── Transcript handler (called on every Deepgram result) ───────────────────
  const handleTranscript = useCallback((text: string) => {
    if (!text.trim()) return
    setTranscript(text)
    setOverlayState('listening')
    clearCollapse()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── UtteranceEnd → run AI ──────────────────────────────────────────────────
  const handleUtteranceEnd = useCallback(async (fullText: string) => {
    if (!fullText.trim()) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    clearCollapse()

    setOverlayState('thinking')
    setBullets([])
    bulletCountRef.current = 0
    streamBuffer.current = ''

    const ctx = sessionData?.context ?? ''
    const sid = sessionData?.sessionId

    try {
      await streamCompletion(
        fullText,
        ctx,
        'copilot',
        (chunk) => {
          streamBuffer.current += chunk

          // Semantic chunk rendering: wait for complete lines (bullets)
          const lines = streamBuffer.current.split('\n')
          streamBuffer.current = lines.pop() ?? '' // keep partial last line

          const newBullets = lines
            .map(l => l.replace(/^[\s\u2022\-\*\d\.]+/, '').trim())
            .filter(Boolean)

          if (newBullets.length > 0 && bulletCountRef.current < 4) {
            setBullets(prev => {
              const combined = [...prev, ...newBullets].slice(0, 4)
              bulletCountRef.current = combined.length
              return combined
            })
            setOverlayState('answer')
          }
        },
        abortRef.current.signal,
        sid,
        [],
      )

      // Flush any remaining buffer on stream end
      const remaining = streamBuffer.current.replace(/^[\s\u2022\-\*\d\.]+/, '').trim()
      if (remaining && bulletCountRef.current < 4) {
        setBullets(prev => [...prev, remaining].slice(0, 4))
        setOverlayState('answer')
      }
    } catch {
      // stream aborted or network error
    }

    scheduleCollapse()
  }, [sessionData, scheduleCollapse]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Deepgram hook ──────────────────────────────────────────────────────────
  const { start, stop, status, audioLevel } = useDeepgram({
    onTranscript:    handleTranscript,
    onUtteranceEnd:  handleUtteranceEnd,
    onStatusChange:  () => {},
    onError:         (e) => console.error('[Overlay]', e),
  })

  // ── IPC: listen for session:init from main window ──────────────────────────
  useEffect(() => {
    if (window.electronOverlay) {
      // Electron mode: wait for session data before starting audio
      const cleanup = window.electronOverlay.onInit((data) => {
        setSessionData(data)
        setOverlayState('listening')
      })
      return cleanup
    } else {
      // Browser dev mode: start immediately with empty context
      setSessionData({ context: '', sessionId: 'dev-' + Date.now() })
      setOverlayState('listening')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start audio when session data is ready ─────────────────────────────────
  useEffect(() => {
    if (!sessionData) return
    start()
    return () => stop()
  }, [sessionData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stop session ───────────────────────────────────────────────────────────
  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    clearCollapse()
    stop()
    window.electronOverlay?.stop()
  }, [stop]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = useCallback(() => {
    clearCollapse()
    setBullets([])
    bulletCountRef.current = 0
    streamBuffer.current = ''
    setOverlayState('listening')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Container height (drives CSS transition) ───────────────────────────────
  const containerHeight =
    overlayState === 'idle'      ? 0
    : overlayState === 'listening' ? 48
    : overlayState === 'thinking'  ? 48
    : Math.min(62 + bullets.length * 36, 270) // answer expands per bullet

  return (
    <div
      className="overlay-container"
      style={{ height: containerHeight }}
      // Hover-to-activate: tell main process to enable mouse when hovering
      onMouseEnter={() => window.electronOverlay?.setInteractive(true)}
      onMouseLeave={() => window.electronOverlay?.setInteractive(false)}
    >
      {/* ── Status bar ──────────────────────────────────────────────────── */}
      {overlayState !== 'idle' && (
        <div className="overlay-bar">
          <span className={`status-dot ${status === 'connected' ? 'live' : 'dim'}`} />

          {status === 'connected' && <AudioBars level={audioLevel} />}

          {overlayState === 'listening' && (
            <span className="transcript-line">{transcript || '\u00a0'}</span>
          )}

          {overlayState === 'thinking' && (
            <span className="thinking-line">
              <span className="thinking-dot" />
              Analyzing…
            </span>
          )}

          {overlayState === 'answer' && (
            <span className="transcript-line" style={{ fontSize: 10.5, opacity: 0.6 }}>
              {transcript}
            </span>
          )}

          <div className="bar-actions">
            {overlayState === 'answer' && (
              <button className="icon-btn" onClick={handleDismiss} title="Dismiss answer (↵)">
                ↙
              </button>
            )}
            <button className="icon-btn stop" onClick={handleStop} title="Stop session">
              ■
            </button>
          </div>
        </div>
      )}

      {/* ── Answer bullets ──────────────────────────────────────────────── */}
      {overlayState === 'answer' && bullets.length > 0 && (
        <>
          <div className="divider" />
          <div className="overlay-answer">
            {bullets.map((bullet, i) => (
              <div key={i} className="bullet-row" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="bullet-dot">•</span>
                <span className="bullet-text">{bullet}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
