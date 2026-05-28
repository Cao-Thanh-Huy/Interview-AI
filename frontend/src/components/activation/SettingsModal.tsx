import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, X, Key, Shield, CheckCircle2, AlertTriangle,
  Loader2, Eye, EyeOff, ExternalLink, RefreshCw
} from 'lucide-react'

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

function SettingsModal({ onClose, onLicenseDeactivated }: ModalProps) {
  const [tab, setTab] = useState<'api' | 'license'>('api')

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        key="modal"
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
      >
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
            <div className="flex items-center gap-2.5">
              <Settings className="w-4 h-4 text-zinc-400" />
              <span className="font-semibold text-white text-sm">Settings</span>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-6 pt-4">
            <button
              onClick={() => setTab('api')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === 'api' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Key className="w-3.5 h-3.5" /> API Keys
            </button>
            <button
              onClick={() => setTab('license')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === 'license' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Shield className="w-3.5 h-3.5" /> License
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 pb-6">
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
    fetch('/api/settings/api-keys').then(r => r.json()).then(setStatus).catch(() => {})
  }, [])

  const handleSave = useCallback(async () => {
    if (!groqKey.trim() && !deepgramKey.trim()) {
      setError('Enter at least one API key to update')
      return
    }
    setSaving(true); setError('');    setSaved(false)
    try {
      const res = await fetch('/api/settings/api-keys', {
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

  return (
    <div className="space-y-4 mt-2">
      {status && (
        <div className="flex gap-2">
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${status.groqKeySet ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
            <CheckCircle2 className="w-3 h-3" /> Groq {status.groqKeySet ? 'Set' : 'Not set'}
          </span>
          <span className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${status.deepgramKeySet ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
            <CheckCircle2 className="w-3 h-3" /> Deepgram {status.deepgramKeySet ? 'Set' : 'Not set'}
          </span>
        </div>
      )}

      {/* Groq */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-zinc-400">Groq API Key</label>
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
            Get key <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="relative">
          <input type={showGroq ? 'text' : 'password'} value={groqKey}
            onChange={e => { setGroqKey(e.target.value); setError('') }}
            placeholder={status?.groqKeySet ? 'Leave blank to keep current key' : 'gsk_xxxxxxxxxxxx'}
            className="w-full px-3 py-2 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all"
          />
          <button onClick={() => setShowGroq(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            {showGroq ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Deepgram */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-zinc-400">Deepgram API Key</label>
          <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300">
            Get key <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="relative">
          <input type={showDeepgram ? 'text' : 'password'} value={deepgramKey}
            onChange={e => { setDeepgramKey(e.target.value); setError('') }}
            placeholder={status?.deepgramKeySet ? 'Leave blank to keep current key' : 'xxxxxxxxxxxxxxxx'}
            className="w-full px-3 py-2 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-200 placeholder:text-zinc-600 font-mono focus:outline-none focus:ring-1 focus:ring-teal-500/50 transition-all"
          />
          <button onClick={() => setShowDeepgram(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            {showDeepgram ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <p className="text-xs text-emerald-300">API keys saved successfully!</p>
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-zinc-700 disabled:to-zinc-700 text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
      >
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Key className="w-3.5 h-3.5" /> Update Keys</>}
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
    fetch('/api/license/status').then(r => r.json()).then(setInfo).catch(() => {})
  }, [])

  const handleDeactivate = useCallback(async () => {
    setLoading(true)
    try {
      await fetch('/api/license/deactivate', { method: 'POST' })
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
