import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, X, Key, Shield, CheckCircle2, AlertTriangle,
  Loader2, Eye, EyeOff, ExternalLink, RefreshCw
} from 'lucide-react'
import { apiUrl } from '@/lib/api'

interface SettingsModalProps {
  onLicenseDeactivated?: () => void
}

export function SettingsButton({ onLicenseDeactivated }: SettingsModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating gear button */}
      <button
        id="settings-btn"
        onClick={() => setOpen(true)}
        title="Settings"
        className="fixed bottom-4 right-4 z-50 w-9 h-9 rounded-full bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 backdrop-blur flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-all shadow-lg hover:scale-110 active:scale-95"
      >
        <Settings className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <SettingsModal
            onClose={() => setOpen(false)}
            onLicenseDeactivated={() => {
              setOpen(false)
              onLicenseDeactivated?.()
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Modal content ────────────────────────────────────────────────────────────
interface ModalProps {
  onClose: () => void
  onLicenseDeactivated: () => void
}

export function SettingsModal({ onClose, onLicenseDeactivated }: ModalProps) {
  const [tab, setTab] = useState<'api' | 'license'>('api')

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <>
      {/* Backdrop — solid dark, no blur */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)' }}
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        style={{ position: 'fixed', inset: 0, zIndex: 51, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, pointerEvents: 'none' }}
      >
        <div style={{ width: '100%', maxWidth: 420, background: 'var(--bg)', border: '1px solid var(--line-2)', borderRadius: 12, boxShadow: '0 16px 48px rgba(0,0,0,0.5)', overflow: 'hidden', pointerEvents: 'auto' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={14} color="var(--muted)" />
              <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>Settings</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
              <X size={14} />
            </button>
          </div>

          {/* Tabs — flat dark pills */}
          <div style={{ display: 'flex', gap: 4, padding: '12px 20px 0' }}>
            <button
              onClick={() => setTab('api')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                background: tab === 'api' ? 'var(--surface)' : 'transparent',
                color: tab === 'api' ? 'var(--text)' : 'var(--muted)',
                transition: 'background 120ms ease-out, color 120ms ease-out',
              }}
            >
              <Key size={12} /> API Keys
            </button>
            <button
              onClick={() => setTab('license')}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                border: 'none', cursor: 'pointer',
                background: tab === 'license' ? 'var(--surface)' : 'transparent',
                color: tab === 'license' ? 'var(--text)' : 'var(--muted)',
                transition: 'background 120ms ease-out, color 120ms ease-out',
              }}
            >
              <Shield size={12} /> License
            </button>
          </div>

          {/* Content */}
          <div style={{ padding: '16px 20px 20px' }}>
            {tab === 'api' ? (
              <ApiKeysTab />
            ) : (
              <LicenseTab onDeactivated={onLicenseDeactivated} />
            )}
          </div>
        </div>
      </motion.div>
    </>
  )
}

// ─── Tab: API Keys ────────────────────────────────────────────────────────────
function ApiKeysTab() {
  const [groqKey, setGroqKey] = useState('')
  const [deepgramKey, setDeepgramKey] = useState('')
  const [showGroq, setShowGroq] = useState(false)
  const [showDeepgram, setShowDeepgram] = useState(false)
  const [status, setStatus] = useState<{ groqKeySet: boolean; deepgramKeySet: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(apiUrl('/settings/api-keys')).then(r => r.json()).then(setStatus).catch(() => {})
  }, [])

  const handleSave = useCallback(async () => {
    if (!groqKey.trim() && !deepgramKey.trim()) {
      setError('Enter at least one API key to update')
      return
    }
    setSaving(true); setError('');    setSaved(false)
    try {
      const res = await fetch(apiUrl('/settings/api-keys'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groqKey: groqKey.trim(), deepgramKey: deepgramKey.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setSaved(true)
        setGroqKey(''); setDeepgramKey('')
        setStatus({ groqKeySet: data.groqKeySet, deepgramKeySet: data.deepgramKeySet })
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(data.message ?? 'Unknown error')
      }
    } catch {
      setError('Cannot connect to backend')
    } finally {
      setSaving(false)
    }
  }, [groqKey, deepgramKey])

  // Groq key input
  const inputStyle = {
    width: '100%', padding: '7px 32px 7px 10px',
    background: 'var(--surface)', border: '1px solid var(--line)',
    borderRadius: 6, fontSize: 12, color: 'var(--text)',
    fontFamily: 'monospace', outline: 'none',
    transition: 'border-color 120ms ease-out',
  } as const

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
      {/* Status badges */}
      {status && (
        <div style={{ display: 'flex', gap: 8 }}>
          <span className={status.groqKeySet ? 'badge-success' : 'badge-muted'}>
            <CheckCircle2 size={10} /> Groq {status.groqKeySet ? 'Set' : 'Not set'}
          </span>
          <span className={status.deepgramKeySet ? 'badge-success' : 'badge-muted'}>
            <CheckCircle2 size={10} /> Deepgram {status.deepgramKeySet ? 'Set' : 'Not set'}
          </span>
        </div>
      )}

      {/* Groq */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Groq API Key</label>
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--primary)', textDecoration: 'none' }}>
            Get key <ExternalLink size={10} />
          </a>
        </div>
        <div style={{ position: 'relative' }}>
          <input type={showGroq ? 'text' : 'password'} value={groqKey}
            onChange={e => { setGroqKey(e.target.value); setError('') }}
            placeholder={status?.groqKeySet ? 'Leave blank to keep current' : 'gsk_xxxxxxxxxxxx'}
            style={inputStyle}
          />
          <button onClick={() => setShowGroq(v => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            {showGroq ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>

      {/* Deepgram */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Deepgram API Key</label>
          <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#2dd4bf', textDecoration: 'none' }}>
            Get key <ExternalLink size={10} />
          </a>
        </div>
        <div style={{ position: 'relative' }}>
          <input type={showDeepgram ? 'text' : 'password'} value={deepgramKey}
            onChange={e => { setDeepgramKey(e.target.value); setError('') }}
            placeholder={status?.deepgramKeySet ? 'Leave blank to keep current' : 'xxxxxxxxxxxxxxxx'}
            style={inputStyle}
          />
          <button onClick={() => setShowDeepgram(v => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            {showDeepgram ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 6 }}>
          <AlertTriangle size={12} color="var(--danger)" />
          <p style={{ fontSize: 11, color: 'var(--danger)' }}>{error}</p>
        </div>
      )}
      {saved && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 6 }}>
          <CheckCircle2 size={12} color="var(--success)" />
          <p style={{ fontSize: 11, color: 'var(--success)' }}>API keys saved successfully!</p>
        </div>
      )}

      {/* Save button — solid primary, no gradient */}
      <button onClick={handleSave} disabled={saving}
        className="btn btn-primary w-full py-2 flex items-center justify-center gap-2"
        style={{ opacity: saving ? 0.5 : 1 }}
      >
        {saving ? <><Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Key size={13} /> Update Keys</>}
      </button>
    </div>
  )
}

// ─── Tab: License ─────────────────────────────────────────────────────────────
function LicenseTab({ onDeactivated }: { onDeactivated: () => void }) {
  const [info, setInfo] = useState<{ activated: boolean; hwid: string; expiresAt: string | null } | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    fetch(apiUrl('/license/status')).then(r => r.json()).then(setInfo).catch(() => {})
  }, [])

  const handleDeactivate = useCallback(async () => {
    setLoading(true)
    try {
      await fetch(apiUrl('/license/deactivate'), { method: 'POST' })
      onDeactivated()
    } catch {
      setLoading(false)
    }
  }, [onDeactivated])

  return (
    <div className="space-y-4 mt-2">
      {info && (
        <div className="p-3 bg-zinc-800/60 border border-zinc-700 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Status</span>
            <span className={`text-xs font-semibold flex items-center gap-1 ${info.activated ? 'text-emerald-400' : 'text-amber-400'}`}>
              <CheckCircle2 className="w-3 h-3" />
              {info.activated ? 'Activated' : 'Not activated'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">HWID</span>
            <span className="text-xs font-mono text-violet-300">{info.hwid}</span>
          </div>
          {info.expiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400">Expires</span>
              <span className="text-xs text-zinc-300">
                {new Date(info.expiresAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl">
        <p className="text-xs text-amber-300/80 leading-relaxed">
          <span className="font-semibold">Re-enter License Key</span> when your key expires or you receive a new one.
          This will sign you out and prompt for a new key.
        </p>
      </div>

      {!confirm ? (
        <button onClick={() => setConfirm(true)}
          className="w-full py-2 border border-amber-500/40 hover:border-amber-400 text-amber-400 hover:text-amber-300 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Re-enter License Key
        </button>
      ) : (
        <div className="space-y-2">
            <p className="text-xs text-zinc-400 text-center">Are you sure you want to clear the current license?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirm(false)}
              className="flex-1 py-2 border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button onClick={handleDeactivate} disabled={loading}
              className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
