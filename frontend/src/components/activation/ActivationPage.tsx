import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Shield, ShieldCheck, Loader2, AlertTriangle, Zap } from 'lucide-react'
import { apiUrl } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface LicenseStatusResponse {
  activated: boolean
  message: string
  hwid: string
  expiresAt: string | null
}

// ─── Splash Screen — hiện khi đang kết nối backend ───────────────────────────
function SplashScreen() {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      gap: 16,
    }}>
      <div style={{
        width: 56, height: 56,
        borderRadius: 16,
        background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
        boxShadow: '0 8px 32px rgba(99,102,241,0.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Zap size={28} color="#fff" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          IntelliView
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
          Connecting to system...
        </p>
      </div>
      <Loader2 size={20} color="var(--primary)" style={{ animation: 'spin 1s linear infinite', marginTop: 8 } as React.CSSProperties} />
    </div>
  )
}

// ─── Activation Page ──────────────────────────────────────────────────────────
interface ActivationPageProps {
  hwid: string
  errorMessage: string
  onActivated: () => void
}

function ActivationPage({ hwid, errorMessage, onActivated }: ActivationPageProps) {
  const [key, setKey] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [feedbackMsg, setFeedbackMsg] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleActivate() {
    if (!key.trim()) return
    setStatus('loading')
    setFeedbackMsg('')

    try {
      const res = await fetch(apiUrl('/license/activate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim() }),
      })
      const data = await res.json()

      if (data.success) {
        setStatus('idle')
        onActivated()
      } else {
        setStatus('error')
        setFeedbackMsg(data.message ?? 'Invalid License Key')
      }
    } catch {
      setStatus('error')
      setFeedbackMsg('Cannot connect to backend — please try again')
    }
  }

  function handleCopyHWID() {
    try {
      // Priority 1: Electron native clipboard (always works, no permission needed)
      const ec = (window as unknown as { electronClipboard?: { write: (t: string) => void } }).electronClipboard
      if (ec) {
        ec.write(hwid)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      }
      // Priority 2: Web Clipboard API (browser)
      navigator.clipboard.writeText(hwid).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }).catch(() => {
        execCommandFallback()
      })
    } catch {
      execCommandFallback()
    }
  }

  function execCommandFallback() {
    // Priority 3: Legacy execCommand (deprecated but reliable fallback)
    try {
      const el = document.createElement('textarea')
      el.value = hwid
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* nothing */ }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
      padding: 16,
      overflow: 'hidden',
    }}>
      {/* Ambient background glows */}
      <div aria-hidden style={{
        position: 'absolute', top: '-10%', right: '-5%',
        width: 500, height: 500,
        borderRadius: '50%',
        background: 'rgba(99,102,241,0.04)',
        filter: 'blur(120px)',
        pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: '-10%', left: '-5%',
        width: 400, height: 400,
        borderRadius: '50%',
        background: 'rgba(6,182,212,0.04)',
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ position: 'relative', width: '100%', maxWidth: 440, zIndex: 10 }}
      >
        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--line-2)',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 24px 64px rgba(0,0,0,0.40)',
        }}>

          {/* Icon + Title */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(99,102,241,0.30)',
            }}>
              <Shield size={32} color="#fff" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
                Activate Software
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text-2)' }}>
                IntelliView · License Key required to continue
              </p>
            </div>
          </div>

          {/* HWID Box */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block', fontSize: 10, fontWeight: 600,
              color: 'var(--muted)', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              Your Machine ID (HWID)
            </label>
            <button
              id="hwid-copy-btn"
              onClick={handleCopyHWID}
              title="Click to copy"
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '10px 14px',
                background: 'rgba(99,102,241,0.06)',
                border: '1px solid rgba(99,102,241,0.18)',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'border-color 150ms ease-out, background 150ms ease-out',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.40)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.10)'
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.18)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.06)'
              }}
            >
              <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--primary)', letterSpacing: '0.08em', fontWeight: 600 }}>
                {hwid}
              </span>
              <span style={{
                fontSize: 11, color: copied ? 'var(--success)' : 'var(--text-2)',
                flexShrink: 0,
                transition: 'color 150ms ease-out',
                fontWeight: 500,
              }}>
                {copied ? '✓ Copied!' : 'Click to copy'}
              </span>
            </button>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--muted)' }}>
              Send this code to the developer to receive your License Key.
            </p>
          </div>

          {/* License Key Input */}
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="license-key-input" style={{
              display: 'block', fontSize: 10, fontWeight: 600,
              color: 'var(--muted)', letterSpacing: '0.08em',
              textTransform: 'uppercase', marginBottom: 8,
            }}>
              Enter License Key
            </label>
            <textarea
              id="license-key-input"
              value={key}
              onChange={(e) => {
                setKey(e.target.value)
                setStatus('idle')
                setFeedbackMsg('')
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleActivate()
                }
              }}
              placeholder="Paste your License Key here..."
              rows={3}
              className="input-dark"
              style={{ fontFamily: 'monospace', fontSize: 12, resize: 'none' }}
            />
          </div>

          {/* Error messages */}
          {errorMessage && status !== 'error' && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
              padding: '10px 12px',
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.20)',
              borderRadius: 8,
            }}>
              <AlertTriangle size={14} color="var(--warn)" style={{ flexShrink: 0, marginTop: 1 } as React.CSSProperties} />
              <p style={{ margin: 0, fontSize: 12, color: '#d4a017', lineHeight: 1.5 }}>{errorMessage}</p>
            </div>
          )}

          {status === 'error' && feedbackMsg && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16,
              padding: '10px 12px',
              background: 'rgba(244,63,94,0.08)',
              border: '1px solid rgba(244,63,94,0.20)',
              borderRadius: 8,
            }}>
              <AlertTriangle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 } as React.CSSProperties} />
              <p style={{ margin: 0, fontSize: 12, color: 'var(--danger)', lineHeight: 1.5 }}>{feedbackMsg}</p>
            </div>
          )}

          {/* Activate Button */}
          <button
            id="activate-btn"
            onClick={handleActivate}
            disabled={!key.trim() || status === 'loading'}
            style={{
              width: '100%',
              padding: '12px 16px',
              background: (!key.trim() || status === 'loading')
                ? 'var(--surface-hover)'
                : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 60%, #06b6d4 100%)',
              color: (!key.trim() || status === 'loading') ? 'var(--muted)' : '#fff',
              fontWeight: 700, fontSize: 14,
              border: 'none', borderRadius: 10,
              cursor: (!key.trim() || status === 'loading') ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: (!key.trim() || status === 'loading')
                ? 'none'
                : '0 6px 24px rgba(99,102,241,0.35)',
              transition: 'opacity 150ms ease-out, box-shadow 150ms ease-out',
            }}
          >
            {status === 'loading' ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' } as React.CSSProperties} />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck size={16} />
                Activate
              </>
            )}
          </button>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', margin: '16px 0 0' }}>
            Need help? Contact the developer with your HWID above.
          </p>
        </div>
      </motion.div>

      {/* Inline spin keyframe for Loader2 */}
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

// ─── Hook: kiểm tra license với auto-retry khi backend chưa sẵn sàng ─────────
type LicenseState = 'connecting' | 'activated' | 'not_activated'

export function useLicenseCheck() {
  const [state, setState] = useState<LicenseState>('connecting')
  const [hwid, setHwid] = useState('')
  const [message, setMessage] = useState('')

  const check = useCallback(async (attempt = 0) => {
    try {
      const res = await fetch(apiUrl('/license/status'))
      if (!res.ok) throw new Error('non-ok response')
      const data: LicenseStatusResponse = await res.json()

      setHwid(data.hwid)
      setMessage(data.message)
      setState(data.activated ? 'activated' : 'not_activated')
    } catch {
      // Backend chưa sẵn sàng — retry với backoff tối đa 12 lần (~18 giây)
      if (attempt < 12) {
        setTimeout(() => check(attempt + 1), 1500)
      } else {
        setMessage('Cannot connect to backend after 18 seconds')
        setState('not_activated')
      }
    }
  }, [])

  useEffect(() => {
    check()
  }, [check])

  const markActivated = useCallback(() => setState('activated'), [])

  return { state, hwid, message, markActivated }
}

// ─── Exported components ──────────────────────────────────────────────────────
export { SplashScreen, ActivationPage }
