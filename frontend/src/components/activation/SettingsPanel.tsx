/**
 * SettingsPanel — embedded panel for SetupScreen Settings tab.
 * Contains API key management and license status/re-activation.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Key, Shield, CheckCircle2, AlertTriangle,
  Loader2, Eye, EyeOff, ExternalLink, RefreshCw
} from 'lucide-react'
import { apiUrl } from '@/lib/api'

// ─── API Keys Section ─────────────────────────────────────────────────────────
function ApiKeysSection() {
  const [groqKey, setGroqKey] = useState('')
  const [deepgramKey, setDeepgramKey] = useState('')
  const [showGroq, setShowGroq] = useState(false)
  const [showDeepgram, setShowDeepgram] = useState(false)
  const [keyStatus, setKeyStatus] = useState<{ groqKeySet: boolean; deepgramKeySet: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(apiUrl('/settings/api-keys')).then(r => r.json()).then(setKeyStatus).catch(() => {})
  }, [])

  const handleSave = useCallback(async () => {
    if (!groqKey.trim() && !deepgramKey.trim()) {
      setError('Enter at least one API key to update')
      return
    }
    setSaving(true); setError(''); setSaved(false)
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
        setKeyStatus({ groqKeySet: data.groqKeySet, deepgramKeySet: data.deepgramKeySet })
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
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Key className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-700">API Keys</h3>
        {keyStatus && (
          <div className="flex gap-1.5 ml-auto">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${keyStatus.groqKeySet ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
              Groq {keyStatus.groqKeySet ? '✓' : '✗'}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${keyStatus.deepgramKeySet ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
              Deepgram {keyStatus.deepgramKeySet ? '✓' : '✗'}
            </span>
          </div>
        )}
      </div>

      {/* Groq */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Groq API Key</label>
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700">
            Get free key <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="relative">
          <input type={showGroq ? 'text' : 'password'} value={groqKey}
            onChange={e => { setGroqKey(e.target.value); setError('') }}
            placeholder={keyStatus?.groqKeySet ? 'Leave blank to keep current key' : 'gsk_xxxxxxxxxxxx'}
            className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
          />
          <button onClick={() => setShowGroq(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showGroq ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">Used for AI suggestions. Free: 6,000 requests/day.</p>
      </div>

      {/* Deepgram */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Deepgram API Key</label>
          <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700">
            Get free key <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="relative">
          <input type={showDeepgram ? 'text' : 'password'} value={deepgramKey}
            onChange={e => { setDeepgramKey(e.target.value); setError('') }}
            placeholder={keyStatus?.deepgramKeySet ? 'Leave blank to keep current key' : 'xxxxxxxxxxxxxxxx'}
            className="w-full px-3 py-2 pr-10 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
          />
          <button onClick={() => setShowDeepgram(v => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            {showDeepgram ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-1">Used for real-time speech recognition. Free: $200 credits.</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}
      {saved && (
        <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-700">API keys saved successfully!</p>
        </div>
      )}

      <button onClick={handleSave} disabled={saving}
        className="w-full py-2 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:from-slate-200 disabled:to-slate-200 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/20"
      >
        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Key className="w-3.5 h-3.5" /> Update Keys</>}
      </button>

      <p className="text-xs text-slate-400 text-center">
        🔒 Keys are saved locally on your machine and never sent anywhere.
      </p>
    </div>
  )
}

// ─── License Section ──────────────────────────────────────────────────────────
function LicenseSection() {
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
      window.location.reload()
    } catch {
      setLoading(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-indigo-500" />
        <h3 className="text-sm font-semibold text-slate-700">License</h3>
      </div>

      {info && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Status</span>
            <span className={`text-xs font-semibold flex items-center gap-1 ${info.activated ? 'text-emerald-600' : 'text-amber-600'}`}>
              <CheckCircle2 className="w-3 h-3" />
              {info.activated ? 'Activated' : 'Not activated'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">HWID</span>
            <span className="text-xs font-mono text-indigo-600">{info.hwid}</span>
          </div>
          {info.expiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Expires</span>
              <span className="text-xs text-slate-700">{new Date(info.expiresAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      )}

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-xs text-amber-700 leading-relaxed">
          <span className="font-semibold">Re-enter License Key</span> when your key expires or you receive a new one.
          This will reload the app and prompt for a new key.
        </p>
      </div>

      {!confirm ? (
        <button onClick={() => setConfirm(true)}
          className="w-full py-2 border border-amber-300 hover:border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Re-enter License Key
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 text-center">Are you sure you want to clear the current license?</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirm(false)}
              className="flex-1 py-2 border border-slate-200 text-slate-500 hover:text-slate-700 text-xs font-medium rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button onClick={handleDeactivate} disabled={loading}
              className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
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

// ─── Main export ──────────────────────────────────────────────────────────────
export function SettingsPanel() {
  const [section, setSection] = useState<'api' | 'license'>('api')

  return (
    <div className="space-y-4 py-2">
      {/* Section tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button
          onClick={() => setSection('api')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            section === 'api' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Key className="w-3.5 h-3.5" /> API Keys
        </button>
        <button
          onClick={() => setSection('license')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            section === 'license' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Shield className="w-3.5 h-3.5" /> License
        </button>
      </div>

      {section === 'api' ? <ApiKeysSection /> : <LicenseSection />}
    </div>
  )
}
