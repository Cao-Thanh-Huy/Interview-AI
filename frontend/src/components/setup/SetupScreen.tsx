import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Mic } from 'lucide-react'
import { CVUpload } from './CVUpload'
import { useInterviewStore } from '@/store/useInterviewStore'
import { cn } from '@/lib/utils'

export function SetupScreen() {
  const { context, setContext, setPhase } = useInterviewStore()
  const [isStarting, setIsStarting] = useState(false)

  const handleStart = () => {
    setIsStarting(true)
    // Small delay for exit animation
    setTimeout(() => setPhase('interview'), 250)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0a0f]">
      {/* Background glows */}
      <div
        aria-hidden
        className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-violet-700/10 rounded-full blur-[120px] pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-cyan-500/8 rounded-full blur-[100px] pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-xl shadow-violet-500/20 mb-5">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Interview Copilot</h1>
          <p className="text-white/40 text-sm">Real-time AI assistance during your live interview</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6 shadow-2xl shadow-black/60 space-y-6">
          {/* Context */}
          <div className="space-y-2">
            <label htmlFor="context" className="block text-sm font-medium text-white/70">
              💼 Interview Context
            </label>
            <textarea
              id="context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Senior React Developer at Acme Corp. Keep answers concise, use STAR method, 3-4 bullet points max."
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 resize-none outline-none focus:border-violet-500/60 focus:bg-white/[0.06] transition-all duration-200"
            />
            <p className="text-xs text-white/25">AI uses this to tailor every suggestion</p>
          </div>

          {/* CV Upload */}
          <CVUpload />

          {/* Divider */}
          <div className="border-t border-white/5" />

          {/* Start */}
          <button
            onClick={handleStart}
            disabled={isStarting}
            className={cn(
              'w-full py-3.5 rounded-xl font-semibold text-white text-sm',
              'bg-gradient-to-r from-violet-600 to-cyan-500',
              'hover:from-violet-500 hover:to-cyan-400',
              'transition-all duration-200',
              'flex items-center justify-center gap-2',
              'shadow-lg shadow-violet-600/25',
              'disabled:opacity-60 disabled:cursor-not-allowed',
            )}
          >
            {isStarting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Starting session...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start Interview Session
              </>
            )}
          </button>
        </div>

        {/* Hint */}
        <p className="text-center text-xs text-white/20 mt-5">
          Press{' '}
          <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-white/35 font-mono">
            Ctrl+Shift+H
          </kbd>{' '}
          during interview to toggle stealth mode
        </p>
      </motion.div>
    </div>
  )
}
