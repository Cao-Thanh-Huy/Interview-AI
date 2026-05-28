import { useState, useEffect, useCallback } from 'react'
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

  // Kiểm tra keys hiện tại
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

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#f6f8fb] p-4 overflow-y-auto relative">
      <div aria-hidden className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div aria-hidden className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-sky-400/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-lg my-8 z-10"
      >
        <div className="bg-white/70 backdrop-blur-sm border border-slate-200/50 rounded-2xl p-8 shadow-2xl shadow-slate-200/50">

          {/* Header */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Key className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-slate-800">API Key Setup</h1>
              <p className="text-sm text-slate-500 mt-1">
                Step 2/2 — Connect AI services
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex gap-2 mb-8">
            <div className="flex-1 h-1 rounded-full bg-indigo-500" />
            <div className="flex-1 h-1 rounded-full bg-indigo-300" />
          </div>

          {/* Groq API Key */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400 text-xs font-bold">G</span>
                Groq API Key
                {existing.groqKeySet && (
                  <span className="flex items-center gap-1 text-emerald-400 text-xs normal-case tracking-normal font-normal">
                    <CheckCircle2 className="w-3 h-3" /> Configured
                  </span>
                )}
              </label>
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                Get free key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                id="groq-key-input"
                type={showGroq ? 'text' : 'password'}
                value={groqKey}
                onChange={e => { setGroqKey(e.target.value); setStatus('idle') }}
                placeholder={existing.groqKeySet ? 'Leave blank to keep current key' : 'gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
              />
              <button
                onClick={() => setShowGroq(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showGroq ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Used for interview question processing & AI suggestions. Free tier: 6,000 requests/day.
            </p>
          </div>

          {/* Deepgram API Key */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-600/20 border border-teal-500/40 flex items-center justify-center text-teal-400 text-xs font-bold">D</span>
                Deepgram API Key
                {existing.deepgramKeySet && (
                  <span className="flex items-center gap-1 text-emerald-400 text-xs normal-case tracking-normal font-normal">
                    <CheckCircle2 className="w-3 h-3" /> Configured
                  </span>
                )}
              </label>
              <a
                href="https://console.deepgram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 transition-colors"
              >
                Get free key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="relative">
              <input
                id="deepgram-key-input"
                type={showDeepgram ? 'text' : 'password'}
                value={deepgramKey}
                onChange={e => { setDeepgramKey(e.target.value); setStatus('idle') }}
                placeholder={existing.deepgramKeySet ? 'Leave blank to keep current key' : 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                className="w-full px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
              />
              <button
                onClick={() => setShowDeepgram(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showDeepgram ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-1.5">
              Used for realtime speech recognition. Free tier: $200 credits.
            </p>
          </div>

          {/* Info box */}
          <div className="mb-6 p-3 bg-slate-50 border border-slate-200/80 rounded-xl">
            <p className="text-xs text-slate-500 leading-relaxed">
              <span className="text-slate-600 font-medium">🔒 Secure:</span> Keys are saved locally on your machine and never sent anywhere.
              You can update them anytime from the Settings menu.
            </p>
          </div>

          {/* Feedback */}
          {status === 'error' && message && (
            <div className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{message}</p>
            </div>
          )}
          {status === 'success' && (
            <div className="flex items-start gap-2 mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700">{message}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              id="api-setup-save-btn"
              onClick={handleSave}
              disabled={!canSave || status === 'loading' || status === 'success'}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 hover:from-indigo-500 hover:via-indigo-600 hover:to-cyan-500 disabled:from-slate-200 disabled:to-slate-200 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
            >
              {status === 'loading' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : status === 'success' ? (
                <><CheckCircle2 className="w-4 h-4" /> Saved!</>
              ) : (
                <><Key className="w-4 h-4" /> Save &amp; Continue</>
              )}
            </button>

            {/* Skip only if at least one key is already set */}
            {(existing.groqKeySet || existing.deepgramKeySet) && (
              <button
                id="api-setup-skip-btn"
                onClick={onComplete}
                className="px-4 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 font-medium rounded-xl transition-all text-sm"
              >
                Skip
              </button>
            )}
          </div>

          <p className="text-center text-xs text-zinc-600 mt-4">
            Free keys — Sign up at{' '}
            <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:underline">console.groq.com</a>
            {' '}and{' '}
            <a href="https://console.deepgram.com" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">console.deepgram.com</a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * Hook kiểm tra xem API keys đã được set chưa
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
