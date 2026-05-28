import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, EyeOff, Square, Monitor } from 'lucide-react'
import { useInterviewStore } from '@/store/useInterviewStore'
import { useUiMode } from '@/store/useUiMode'
import { StatusDot } from './StatusDot'
import type { DeepgramStatus, AudioSource } from '@/lib/types'

// ─── Elapsed timer ────────────────────────────────────────────────────────────
function useElapsed(startTime: number) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(id)
  }, [startTime])
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

// ─── Plain-text suggestion renderer (NO markdown parser) ──────────────────────
function renderSuggestion(text: string, isGenerating: boolean) {
  if (!text) {
    if (isGenerating) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[11, 9, 7].map((w, i) => (
            <div key={i} style={{ height: 10, borderRadius: 4, background: 'var(--surface-hover)', width: `${w * 10}%`, opacity: 0.6 }} />
          ))}
        </div>
      )
    }
    return null
  }
  // Clean markdown syntax, split lines, render as plain bullets
  const lines = text
    .split('\n')
    .map((l) => l.trim().replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1'))
    .filter(Boolean)

  return (
    <ul className="suggestion-list">
      {lines.map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  )
}

// ─── Turn card ────────────────────────────────────────────────────────────────
interface TurnCardProps {
  question: string
  answer: string
  isGenerating: boolean
  isLast: boolean
}

function TurnCardInner({ question, answer, isGenerating, isLast }: TurnCardProps) {
  return (
    <div className="contain" style={{ paddingBottom: 0 }}>
      {/* Question */}
      <p className="transcript-q" style={{ margin: 0, marginBottom: 8 }}>
        {question}
      </p>

      {/* Suggestion */}
      {(answer || isGenerating) && (
        <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--line-2)', marginBottom: 4 }}>
          {renderSuggestion(answer, isGenerating)}
        </div>
      )}

      {/* Feed divider — not on last item */}
      {!isLast && <div className="feed-divider" style={{ marginTop: 16, marginBottom: 16 }} />}
    </div>
  )
}
const TurnCard = React.memo(TurnCardInner)

// ─── TopBar ───────────────────────────────────────────────────────────────────
interface TopBarProps {
  status: DeepgramStatus
  audioSource: AudioSource
  audioLevel: number     // 0-100
  startTime: number
  isMuted: boolean
  onToggleMute: () => void
  onStop: () => void
  isAlwaysOnTop: boolean
}

function TopBarInner({ status, audioSource, audioLevel, startTime, isMuted, onToggleMute, onStop, isAlwaysOnTop }: TopBarProps) {
  const elapsed = useElapsed(startTime)
  const { toggleStealth } = useInterviewStore()

  return (
    <header className="app-header drag-region" style={{ borderBottom: '1px solid var(--line)' }}>
      {/* Left: status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <StatusDot status={status} />
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>{elapsed}</span>
        {audioSource && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--muted)' }}>
            {audioSource === 'system' ? <Monitor size={11} /> : <Mic size={11} />}
            {audioSource === 'system' ? 'System' : 'Mic'}
            {/* Audio level meter — 5 bars */}
            <span style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 12 }} title={`Audio level: ${audioLevel}`}>
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((threshold, i) => {
                const active = audioLevel > threshold * 100 * 0.4  // scale: any signal shows
                return (
                  <span key={i} style={{
                    width: 2,
                    height: `${(i + 1) * 20}%`,
                    borderRadius: 1,
                    background: active ? '#4ade80' : 'var(--line)',
                    transition: 'background 80ms',
                    display: 'block',
                  }} />
                )
              })}
            </span>
            {status === 'connected' && audioLevel < 2 && (
              <span style={{ fontSize: 9, color: '#f59e0b', letterSpacing: '0.04em' }}>NO SIGNAL</span>
            )}
          </span>
        )}
        {isAlwaysOnTop && (
          <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.08em' }}>⊤ AOT</span>
        )}
      </div>

      {/* Right: actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="btn btn-ghost" onClick={onToggleMute} style={{ padding: '4px 8px', fontSize: 11 }}>
          {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        <button className="btn btn-ghost" onClick={toggleStealth} style={{ padding: '4px 8px', fontSize: 11 }}>
          <EyeOff size={12} /> Hide
        </button>
        <button className="btn btn-danger" onClick={onStop} style={{ padding: '4px 8px', fontSize: 11 }}>
          <Square size={10} strokeWidth={0} fill="currentColor" /> Stop
        </button>
      </div>
    </header>
  )
}
const TopBar = React.memo(TopBarInner)

// ─── Main InterviewScreen ─────────────────────────────────────────────────────
interface Props {
  status: DeepgramStatus
  audioSource: AudioSource
  audioLevel: number
  startTime: number
  isMuted: boolean
  onToggleMute: () => void
  onStop: () => void
  onManualSubmit: (text: string) => void
}

export function InterviewScreenLayout({ status, audioSource, audioLevel, startTime, isMuted, onToggleMute, onStop, onManualSubmit }: Props) {
  const turns = useInterviewStore((s) => s.turns)
  const currentInterimCaption = useInterviewStore((s) => s.currentInterimCaption)
  const stealthMode = useInterviewStore((s) => s.stealthMode)
  const { isAlwaysOnTop } = useUiMode()

  const feedRef = useRef<HTMLDivElement>(null)
  const [manualText, setManualText] = useState('')
  const lastTranscriptTimeRef = useRef(Date.now())

  // Auto-scroll to bottom on new turns
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [turns.length, currentInterimCaption])

  // Track last transcript time for auto-stealth
  useEffect(() => {
    if (currentInterimCaption || turns.length) {
      lastTranscriptTimeRef.current = Date.now()
    }
  }, [currentInterimCaption, turns.length])

  // Auto-collapse stealth after 30s no transcript
  useEffect(() => {
    if (status !== 'connected') return
    const { toggleStealth, stealthMode } = useInterviewStore.getState()
    const timer = setTimeout(() => {
      if (!stealthMode && Date.now() - lastTranscriptTimeRef.current > 30_000) {
        toggleStealth()
      }
    }, 30_000)
    return () => clearTimeout(timer)
  }, [status, turns.length, currentInterimCaption])

  const handleManualKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && manualText.trim()) {
      onManualSubmit(manualText.trim())
      setManualText('')
    }
  }, [manualText, onManualSubmit])

  // ── Stealth mode: 24px strip ────────────────────────────────────────────────
  if (stealthMode) {
    const { toggleStealth } = useInterviewStore.getState()
    return (
      <div
        onClick={toggleStealth}
        title="Click to show (Ctrl+Shift+H)"
        style={{
          height: 24,
          background: 'var(--bg)',
          display: 'flex', alignItems: 'center',
          padding: '0 12px', gap: 8,
          cursor: 'pointer',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <StatusDot status={status} />
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>
          {status === 'connected' ? 'Live' : 'Idle'}
        </span>
      </div>
    )
  }

  // ── Full layout ─────────────────────────────────────────────────────────────
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopBar
        status={status}
        audioSource={audioSource}
        audioLevel={audioLevel}
        startTime={startTime}
        isMuted={isMuted}
        onToggleMute={onToggleMute}
        onStop={onStop}
        isAlwaysOnTop={isAlwaysOnTop}
      />

      {/* Unified cognitive feed */}
      <div
        ref={feedRef}
        className="contain"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 24px',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {turns.length === 0 && !currentInterimCaption && (
          <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)', fontSize: 13, lineHeight: 1.8 }}>
            <StatusDot status={status} />
            <p style={{ marginTop: 12 }}>
              {status === 'connected'
                ? 'Listening... speak or type a question below'
                : 'Connecting to microphone...'}
            </p>
          </div>
        )}

        {/* Turn cards — unified feed, no split sections */}
        {turns.map((turn, i) => (
          <TurnCard
            key={turn.id}
            question={turn.question}
            answer={turn.answer}
            isGenerating={turn.isGenerating}
            isLast={i === turns.length - 1 && !currentInterimCaption}
          />
        ))}

        {/* Interim caption — instant, no animation */}
        {currentInterimCaption && (
          <>
            {turns.length > 0 && <div className="feed-divider" />}
            <p className="transcript-interim" style={{ margin: 0 }}>
              {currentInterimCaption}
              <span style={{ display: 'inline-block', width: 6, height: 12, background: 'var(--muted)', marginLeft: 3, verticalAlign: 'middle', borderRadius: 1, opacity: 0.7 }} />
            </p>
          </>
        )}
      </div>

      {/* Manual input strip */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, flexShrink: 0 }}>
        <input
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          onKeyDown={handleManualKeyDown}
          placeholder="Type question manually and press Enter..."
          className="input-dark"
          style={{ fontSize: 12 }}
        />
      </div>
    </div>
  )
}
