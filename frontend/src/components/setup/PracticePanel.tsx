import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Target } from 'lucide-react'
import { practiceTurn, translateText } from '@/lib/api'
import { useInterviewStore } from '@/store/useInterviewStore'

// ─── Target Orb — visual anchor (giống MicOrb bên SetupTab) ──────────────────
function TargetOrb() {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{
        position: 'absolute', width: 310, height: 310, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
        pointerEvents: 'none', animation: 'micGlow 3.5s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', width: 192, height: 192, borderRadius: '50%',
        border: '1.5px solid rgba(99,102,241,0.22)', pointerEvents: 'none', animation: 'micPulse 3.5s ease-in-out infinite',
      }} />
      <div style={{
        width: 152, height: 152, borderRadius: '50%', background: 'var(--surface)',
        border: '1.5px solid rgba(99,102,241,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1, boxShadow: '0 0 40px rgba(99,102,241,0.12)',
      }}>
        <Target size={48} color="#ffffff" strokeWidth={1.5}
          style={{ animation: 'micIconBreathe 3.5s ease-in-out infinite' }} />
      </div>
    </div>
  )
}

// ─── Types ──────────────────────────────────────────────────────────────────────

type PracticeState = 'idle' | 'asking' | 'answered' | 'error'

interface PracticeTurn {
  id: string
  question: string
  questionTranslation?: string
  suggestion: string
  suggestionTranslation?: string
  showSuggestionTranslation: boolean
}

// ─── Turn Card (browser fallback) ───────────────────────────────────────────────

function PracticeTurnCard({
  turn,
  onTranslateSuggestion,
}: {
  turn: PracticeTurn
  onTranslateSuggestion: (id: string) => void
}) {
  const displaySuggestion = turn.showSuggestionTranslation && turn.suggestionTranslation
    ? turn.suggestionTranslation
    : turn.suggestion

  return (
    <div style={{ padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2, lineHeight: 1.5 }}>
        {turn.question}
      </div>
      {turn.questionTranslation && (
        <div style={{ fontSize: 12, color: 'var(--primary)', fontStyle: 'italic', marginBottom: 12, paddingLeft: 2 }}>
          🇻🇳 {turn.questionTranslation}
        </div>
      )}
      <div style={{ paddingLeft: 12, borderLeft: '2px solid var(--line-2)', position: 'relative' }}>
        {turn.suggestion && !turn.showSuggestionTranslation && (
          <button onClick={() => onTranslateSuggestion(turn.id)} style={{
            position: 'absolute', top: 0, right: 0, padding: '2px 6px', borderRadius: 4,
            border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.1)',
            color: 'var(--primary)', cursor: 'pointer', fontSize: 11, lineHeight: 1.4,
          }} title="Dịch sang tiếng Việt">🌐 Translate</button>
        )}
        {turn.suggestion && turn.showSuggestionTranslation && (
          <button onClick={() => onTranslateSuggestion(turn.id)} style={{
            position: 'absolute', top: 0, right: 0, padding: '2px 6px', borderRadius: 4,
            border: '1px solid rgba(99,102,241,0.7)', background: 'rgba(99,102,241,0.2)',
            color: '#a5b4fc', cursor: 'pointer', fontSize: 11, lineHeight: 1.4,
          }} title="Xem tiếng Anh">🇻🇳 Vietnamese</button>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          <span style={{ color: 'var(--muted)', fontWeight: 600, marginRight: 4 }}>💡</span>
          {displaySuggestion}
        </div>
      </div>
    </div>
  )
}

// ─── Main PracticePanel ─────────────────────────────────────────────────────────

export function PracticePanel() {
  const [persona, setPersona]       = useState('khó tính')
  const [isStarting, setIsStarting] = useState(false)
  const storeContext                = useInterviewStore((s) => s.context)

  // Check if Electron
  const electronSession = (window as unknown as { electronSession?: { start: (d: unknown) => void } }).electronSession

  // ── Browser fallback state ─────────────────────────────────────────────────
  const [state, setState]           = useState<PracticeState>('idle')
  const [turns, setTurns]           = useState<PracticeTurn[]>([])
  const [errorMsg, setErrorMsg]     = useState('')
  const feedRef                     = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight
  }, [turns])

  // ── Start (Electron: overlay, Browser: inline) ─────────────────────────────
  const handleStart = useCallback(() => {
    if (!persona.trim()) return
    if (electronSession) {
      setIsStarting(true)
      electronSession.start({
        context: storeContext,
        sessionId: 'practice-' + Date.now(),
        hubWidth: Number(localStorage.getItem('hub-width')) || 440,
        mode: 'practice',
        prompt: persona.trim(),
      })
      // State reset khi overlay mở
      setIsStarting(false)
    } else {
      // Browser fallback
      setState('asking'); setErrorMsg(''); setTurns([])
      practiceTurn(persona.trim(), 'start', storeContext)
        .then(result => {
          const newTurn: PracticeTurn = {
            id: Date.now().toString(), question: result.question, suggestion: result.suggestion,
            showSuggestionTranslation: false,
          }
          translateText(result.question).then(vn => setTurns(prev => prev.map(t => t.id === newTurn.id ? { ...t, questionTranslation: vn } : t))).catch(() => {})
          if (result.suggestion) translateText(result.suggestion).then(vn => setTurns(prev => prev.map(t => t.id === newTurn.id ? { ...t, suggestionTranslation: vn } : t))).catch(() => {})
          setTurns([newTurn]); setState('answered')
        })
        .catch((err: any) => {
          setErrorMsg(err.message || 'Failed to start practice'); setState('error')
        })
    }
  }, [persona, electronSession, storeContext])

  // ── Next (browser only) ────────────────────────────────────────────────────
  const handleNext = useCallback(async () => {
    if (!persona.trim()) return
    setState('asking'); setErrorMsg('')
    try {
      const result = await practiceTurn(persona.trim(), 'next', storeContext)
      const newTurn: PracticeTurn = {
        id: Date.now().toString(), question: result.question, suggestion: result.suggestion,
        showSuggestionTranslation: false,
      }
      translateText(result.question).then(vn => setTurns(prev => prev.map(t => t.id === newTurn.id ? { ...t, questionTranslation: vn } : t))).catch(() => {})
      if (result.suggestion) translateText(result.suggestion).then(vn => setTurns(prev => prev.map(t => t.id === newTurn.id ? { ...t, suggestionTranslation: vn } : t))).catch(() => {})
      setTurns(prev => [...prev, newTurn]); setState('answered')
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to get next question'); setState('error')
    }
  }, [persona, storeContext])

  const handleTranslateSuggestion = useCallback((id: string) => {
    setTurns(prev => prev.map(t => {
      if (t.id !== id) return t
      if (t.showSuggestionTranslation) return { ...t, showSuggestionTranslation: false }
      if (!t.suggestionTranslation && t.suggestion) {
        translateText(t.suggestion).then(vn => setTurns(p => p.map(pt => pt.id === id ? { ...pt, suggestionTranslation: vn, showSuggestionTranslation: true } : pt))).catch(() => {})
        return { ...t, showSuggestionTranslation: true }
      }
      return { ...t, showSuggestionTranslation: true }
    }))
  }, [])

  const handleReset = useCallback(() => { setState('idle'); setTurns([]); setErrorMsg('') }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  // Electron mode: giống hệt SetupTab (TargetOrb + heading + input + button #5254cc)
  if (electronSession) {
    const canStart = !isStarting && persona.trim().length > 0
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
      }}>
        {/* Target orb animation */}
        <TargetOrb />

        {/* Heading */}
        <h1 style={{
          margin: '32px 0 10px', fontSize: 26, fontWeight: 600,
          color: 'var(--text)', letterSpacing: '-0.02em', textAlign: 'center', lineHeight: 1.2,
        }}>
          Ready to Practice
        </h1>

        {/* Subtitle */}
        <p style={{
          margin: '0 0 24px', fontSize: 14, color: 'var(--text)', opacity: 0.65, textAlign: 'center',
        }}>
          Describe the AI role you want. It will ask questions and suggest answers based on your profile.
        </p>

        {/* Prompt input */}
        <div style={{ width: '100%', maxWidth: 360, marginBottom: 24 }}>
          <label style={{
            display: 'block', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em',
            marginBottom: 6, textTransform: 'uppercase',
          }}>
            Prompt
          </label>
          <input
            value={persona}
            onChange={e => setPersona(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canStart) handleStart() }}
            placeholder="e.g. khó tính, friendly senior, baby, giáo viên..."
            className="input-dark"
            style={{ width: '100%', fontSize: 13 }}
            disabled={isStarting}
          />
        </div>

        {/* Primary CTA — giống Start Session */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 44px',
            background: canStart ? '#5254cc' : '#1e2035',
            color: canStart ? '#fff' : '#3a4560',
            fontSize: 14, fontWeight: 600,
            border: 'none', borderRadius: 8,
            cursor: canStart ? 'pointer' : 'not-allowed',
            boxShadow: canStart
              ? '0 6px 28px rgba(82,84,204,0.50), 0 1px 0 rgba(255,255,255,0.08) inset'
              : 'none',
            transition: 'box-shadow 150ms ease-out, background 150ms ease-out',
          }}
        >
          {isStarting ? 'Starting…' : 'Start Practice →'}
        </button>

        {/* Hint */}
        <span style={{
          position: 'absolute', bottom: 20,
          fontSize: 11, color: 'var(--muted)',
          letterSpacing: '0.04em', userSelect: 'none',
        }}>
          Practice will open in a floating overlay
        </span>
      </div>
    )
  }

  // ── Browser fallback: full inline panel ────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {(state === 'idle' || state === 'error') && turns.length === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px', gap: 12 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>Practice</h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 380, lineHeight: 1.5 }}>
            Tell AI what role you want it to play. It will ask questions and suggest answers based on your profile.
          </p>
          <div style={{ width: '100%', maxWidth: 400 }}>
            <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>Prompt</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={persona} onChange={e => setPersona(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && state === 'idle') handleStart() }} placeholder="e.g. khó tính, friendly senior, baby..." className="input-dark" style={{ flex: 1, fontSize: 13 }} disabled={false} />
              <button onClick={handleStart} disabled={!persona.trim()} className="btn" style={{ padding: '8px 20px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>Start Practice</button>
            </div>
          </div>
        </div>
      )}

      {turns.length > 0 && (
        <div ref={feedRef} style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
          {turns.map(turn => (
            <PracticeTurnCard key={turn.id} turn={turn} onTranslateSuggestion={handleTranslateSuggestion} />
          ))}
          {state === 'asking' && (
            <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--muted)', fontSize: 13 }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--line-2)', borderTopColor: 'var(--primary)', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
              AI is thinking...
            </div>
          )}
          {state === 'error' && errorMsg && (
            <div style={{ padding: '12px 16px', margin: '16px 0', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
              <strong>Error:</strong> {errorMsg}
            </div>
          )}
        </div>
      )}

      {(state === 'answered' || state === 'error') && turns.length > 0 && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--line)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button onClick={handleNext} disabled={state !== 'answered'} className="btn" style={{ flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600 }}>
            {state === 'answered' ? 'Next Question →' : 'Waiting...'}
          </button>
          <button onClick={handleReset} className="btn btn-ghost" style={{ padding: '10px 16px', fontSize: 12 }}>✕ Stop</button>
        </div>
      )}
    </div>
  )
}
