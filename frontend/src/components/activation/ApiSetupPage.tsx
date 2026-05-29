import { useState, useEffect, useCallback } from 'react'
import React from 'react'
import { motion } from 'framer-motion'
import { Key, ExternalLink, CheckCircle2, Loader2, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { apiUrl } from '@/lib/api'

interface ApiKeyStatus {
  groqKeySet: boolean
  deepgramKeySet: boolean
}

interface ApiSetupPageProps {
  onComplete: () => void
}

export function ApiSetupPage({ onComplete }: ApiSetupPageProps) {
  const [groqKey, setGroqKey] = useState('')
  const [deepgramKey, setDeepgramKey] = useState('')
  const [showGroq, setShowGroq] = useState(false)
  const [showDeepgram, setShowDeepgram] = useState(false)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [existing, setExisting] = useState<ApiKeyStatus>({ groqKeySet: false, deepgramKeySet: false })

  useEffect(() => {
    fetch(apiUrl('/settings/api-keys'))
      .then(r => r.json())
      .then((data: ApiKeyStatus) => setExisting(data))
      .catch(() => {})
  }, [])

  const handleSave = useCallback(async () => {
    if (!groqKey.trim() && !deepgramKey.trim()) {
      setStatus('error')
      setMessage('Please enter at least one API key')
      return
    }
    setStatus('loading')
    setMessage('')
    try {
      const res = await fetch(apiUrl('/settings/api-keys'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groqKey: groqKey.trim(), deepgramKey: deepgramKey.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setStatus('success')
        setMessage('Saved! Launching...')
        setTimeout(onComplete, 1200)
      } else {
        setStatus('error')
        setMessage(data.message ?? 'Failed to save API keys')
      }
    } catch {
      setStatus('error')
      setMessage('Cannot connect to backend')
    }
  }, [groqKey, deepgramKey, onComplete])

  const canSave = groqKey.trim().length > 0 || deepgramKey.trim().length > 0

  const inputStyle = (focused?: boolean): React.CSSProperties => ({
    width: '100%',
    padding: '10px 44px 10px 14px',
    background: 'var(--surface)',
    border: `1px solid ${focused ? 'rgba(99,102,241,0.40)' : 'var(--line-2)'}`,
    borderRadius: 10,
    color: 'var(--text)',
    fontSize: 12,
    fontFamily: 'monospace',
    outline: 'none',
    transition: 'border-color 150ms ease-out',
  })

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      padding: 16,
      overflowY: 'auto',
    }}>
      {/* Ambient glows */}
      <div aria-hidden style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: 500, height: 500, borderRadius: '50%',
        background: 'rgba(99,102,241,0.04)', filter: 'blur(120px)', pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: '-10%', left: '-5%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'rgba(6,182,212,0.04)', filter: 'blur(100px)', pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ position: 'relative', width: '100%', maxWidth: 480, margin: '32px 0', zIndex: 10 }}
      >
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line-2)',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 24px 64px rgba(0,0,0,0.40)',
        }}>

          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(99,102,241,0.30)',
            }}>
              <Key size={32} color="#fff" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                API Key Setup
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
                Step 2/2 — Connect AI services
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 99, background: 'var(--primary)' }} />
            <div style={{ flex: 1, height: 3, borderRadius: 99, background: 'rgba(99,102,241,0.25)' }} />
          </div>

          {/* Groq API Key */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 10, fontWeight: 600, color: 'var(--muted)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#a78bfa', fontSize: 10, fontWeight: 700,
                }}>G</span>
                Groq API Key
                {existing.groqKeySet && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 10, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                    <CheckCircle2 size={12} /> Configured
                  </span>
                )}
              </label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#a78bfa', textDecoration: 'none' }}
              >
                Get free key <ExternalLink size={11} />
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="groq-key-input"
                type={showGroq ? 'text' : 'password'}
                value={groqKey}
                onChange={e => { setGroqKey(e.target.value); setStatus('idle') }}
                placeholder={existing.groqKeySet ? 'Leave blank to keep current key' : 'gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                style={inputStyle()}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(99,102,241,0.40)'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--line-2)'}
              />
              <button
                onClick={() => setShowGroq(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0,
                }}
              >
                {showGroq ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Used for interview question processing & AI suggestions. Free tier: 6,000 requests/day.
            </p>
          </div>

          {/* Deepgram API Key */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 10, fontWeight: 600, color: 'var(--muted)',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}>
                <span style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#2dd4bf', fontSize: 10, fontWeight: 700,
                }}>D</span>
                Deepgram API Key
                {existing.deepgramKeySet && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--success)', fontSize: 10, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
                    <CheckCircle2 size={12} /> Configured
                  </span>
                )}
              </label>
              <a
                href="https://console.deepgram.com/"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#2dd4bf', textDecoration: 'none' }}
              >
                Get free key <ExternalLink size={11} />
              </a>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="deepgram-key-input"
                type={showDeepgram ? 'text' : 'password'}
                value={deepgramKey}
                onChange={e => { setDeepgramKey(e.target.value); setStatus('idle') }}
                placeholder={existing.deepgramKeySet ? 'Leave blank to keep current key' : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                style={inputStyle()}
                onFocus={e => (e.target as HTMLInputElement).style.borderColor = 'rgba(99,102,241,0.40)'}
                onBlur={e => (e.target as HTMLInputElement).style.borderColor = 'var(--line-2)'}
              />
              <button
                onClick={() => setShowDeepgram(v => !v)}
                style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 0,
                }}
              >
                {showDeepgram ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Used for realtime speech recognition. Free tier: $200 credits.
            </p>
          </div>

          {/* Info box */}
          <div style={{
            marginBottom: 20, padding: '10px 14px',
            background: 'rgba(99,102,241,0.05)',
            border: '1px solid rgba(99,102,241,0.12)',
            borderRadius: 10,
          }}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>🔒 Secure:</span>{' '}
              Keys are saved locally on your machine and never sent anywhere.
              You can update them anytime from the Settings menu.
            </p>
          </div>

          {/* Feedback */}
          {status === 'error' && message && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
              padding: '10px 12px',
              background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.20)',
              borderRadius: 8,
            }}>
              <AlertTriangle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 } as React.CSSProperties} />
              <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>{message}</p>
            </div>
          )}
          {status === 'success' && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
              padding: '10px 12px',
              background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)',
              borderRadius: 8,
            }}>
              <CheckCircle2 size={14} color="var(--success)" style={{ flexShrink: 0, marginTop: 1 } as React.CSSProperties} />
              <p style={{ margin: 0, fontSize: 12, color: 'var(--success)', lineHeight: 1.5 }}>{message}</p>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              id="api-setup-save-btn"
              onClick={handleSave}
              disabled={!canSave || status === 'loading' || status === 'success'}
              style={{
                flex: 1, padding: '12px 16px',
                background: (!canSave || status === 'loading' || status === 'success')
                  ? 'var(--surface-hover)'
                  : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #06b6d4 100%)',
                color: (!canSave || status === 'loading' || status === 'success') ? 'var(--muted)' : '#fff',
                fontWeight: 700, fontSize: 14,
                border: 'none', borderRadius: 10,
                cursor: (!canSave || status === 'loading' || status === 'success') ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: (!canSave || status === 'loading' || status === 'success')
                  ? 'none' : '0 6px 24px rgba(99,102,241,0.35)',
                transition: 'opacity 150ms ease-out, box-shadow 150ms ease-out',
              }}
            >
              {status === 'loading' ? (
                <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' } as React.CSSProperties} /> Saving...</>
              ) : status === 'success' ? (
                <><CheckCircle2 size={16} /> Saved!</>
              ) : (
                <><Key size={16} /> Save & Continue</>
              )}
            </button>

            {(existing.groqKeySet || existing.deepgramKeySet) && (
              <button
                id="api-setup-skip-btn"
                onClick={onComplete}
                style={{
                  padding: '12px 20px',
                  background: 'transparent',
                  color: 'var(--text-2)',
                  border: '1px solid var(--line-2)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: 500, fontSize: 13,
                  transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--line-2)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text)'
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'
                }}
              >
                Skip
              </button>
            )}
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', margin: '16px 0 0' }}>
            Free keys — Sign up at{' '}
            <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" style={{ color: '#a78bfa' }}>
              console.groq.com
            </a>
            {' '}and{' '}
            <a href="https://console.deepgram.com" target="_blank" rel="noopener noreferrer" style={{ color: '#2dd4bf' }}>
              console.deepgram.com
            </a>
          </p>
        </div>
      </motion.div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

/**
 * Hook to check if API keys have been set
 */
export function useApiKeysCheck() {
  const [checked, setChecked] = useState(false)
  const [keysReady, setKeysReady] = useState(false)

  const check = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/settings/api-keys'))
      const data: ApiKeyStatus = await res.json()
      setKeysReady(data.groqKeySet && data.deepgramKeySet)
    } catch {
      setKeysReady(false)
    } finally {
      setChecked(true)
    }
  }, [])

  useEffect(() => { check() }, [check])

  const markReady = useCallback(() => setKeysReady(true), [])

  return { checked, keysReady, markReady }
}
