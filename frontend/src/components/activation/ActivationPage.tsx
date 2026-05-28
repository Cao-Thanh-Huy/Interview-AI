import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ShieldCheck, Loader2, AlertTriangle, Zap } from 'lucide-react'

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
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f6f8fb] gap-4">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 shadow-xl shadow-indigo-500/20 flex items-center justify-center">
        <Zap className="w-7 h-7 text-white" />
      </div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Interview AI</h1>
        <p className="text-sm text-slate-500 mt-1">Connecting to system...</p>
      </div>
      <Loader2 className="w-5 h-5 text-indigo-500 animate-spin mt-2" />
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
      const res = await fetch('/api/license/activate', {
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

  async function handleCopyHWID() {
    try {
      await navigator.clipboard.writeText(hwid)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API có thể bị chặn
    }
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#f6f8fb] p-4 relative overflow-hidden">
      {/* Background glows matching main app */}
      <div aria-hidden className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div aria-hidden className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-sky-400/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md z-10"
      >
        {/* Card */}
        <div className="bg-white/70 backdrop-blur-sm border border-slate-200/50 rounded-2xl p-8 shadow-2xl shadow-slate-200/50">

          {/* Icon + Title */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center shadow-xl shadow-indigo-500/20">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-slate-800">Activate Software</h1>
              <p className="text-sm text-slate-500 mt-1">Interview AI · License Key required to continue</p>
            </div>
          </div>

          {/* HWID Box */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
              Your Machine ID (HWID)
            </label>
            <button
              id="hwid-copy-btn"
              onClick={handleCopyHWID}
              title="Click to copy"
              className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl hover:border-indigo-300 transition-colors group"
            >
              <span className="font-mono text-sm text-indigo-600 tracking-widest">{hwid}</span>
              <span className="text-xs text-slate-400 group-hover:text-indigo-500 transition-colors shrink-0">
                {copied ? '✓ Copied' : 'Click to copy'}
              </span>
            </button>
            <p className="text-xs text-slate-400 mt-2">
              Send this code to the developer to receive your License Key.
            </p>
          </div>

          {/* License Key Input */}
          <div className="mb-4">
            <label htmlFor="license-key-input" className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
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
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-400 transition-all"
            />
          </div>

          {/* Error message */}
          {errorMessage && status !== 'error' && (
            <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">{errorMessage}</p>
            </div>
          )}

          {status === 'error' && feedbackMsg && (
            <div className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{feedbackMsg}</p>
            </div>
          )}

          {/* Activate Button */}
          <button
            id="activate-btn"
            onClick={handleActivate}
            disabled={!key.trim() || status === 'loading'}
            className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 hover:from-indigo-500 hover:via-indigo-600 hover:to-cyan-500 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Activate
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400 mt-4">
            Need help? Contact the developer with your HWID above.
          </p>
        </div>
      </motion.div>
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
      const res = await fetch('/api/license/status')
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
