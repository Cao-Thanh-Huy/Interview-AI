import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Mic, Dumbbell, History } from 'lucide-react'
import { CVUpload } from './CVUpload'
import { TrainingPanel } from './TrainingPanel'
import { HistoryReviewPanel } from './HistoryReviewPanel'
import { useInterviewStore } from '@/store/useInterviewStore'
import { cn } from '@/lib/utils'

type Tab = 'setup' | 'training' | 'history'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'setup', label: 'Setup Session', icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'training', label: 'Pre-Interview Training', icon: <Dumbbell className="w-3.5 h-3.5" /> },
  { id: 'history', label: 'Interview History', icon: <History className="w-3.5 h-3.5" /> },
]

export function SetupScreen() {
  const { context, setContext, setPhase, initSession } = useInterviewStore()
  const [isStarting, setIsStarting] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('setup')

  const handleStart = () => {
    setIsStarting(true)
    initSession()
    setTimeout(() => setPhase('interview'), 250)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#f6f8fb]">
      {/* Background glows */}
      <div
        aria-hidden
        className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"
      />
      <div
        aria-hidden
        className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-sky-400/5 rounded-full blur-[100px] pointer-events-none"
      />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 shadow-xl shadow-indigo-500/20 mb-5 animate-pulse">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">Interview Copilot</h1>
          <p className="text-slate-500 text-sm font-medium">Real-time AI assistance during your live interview</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100/80 rounded-2xl p-1 mb-4 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-semibold transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-white text-indigo-700 shadow-sm shadow-slate-200'
                  : 'text-slate-500 hover:text-slate-700',
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-6 shadow-2xl shadow-slate-200/50 bg-white/70">
          {/* Tab 1: Setup Session */}
          {activeTab === 'setup' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="context" className="block text-sm font-medium text-slate-700">
                  💼 Interview Context
                </label>
                <textarea
                  id="context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., Senior React Developer at Acme Corp. Keep answers concise, use STAR method, 3-4 bullet points max."
                  rows={3}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm placeholder:text-slate-400 resize-none outline-none focus:border-indigo-500/60 focus:bg-white transition-all duration-200 shadow-sm"
                />
                <p className="text-[10px] text-slate-400 font-semibold tracking-wide">AI uses this to tailor every suggestion</p>
              </div>

              <CVUpload />

              <div className="border-t border-slate-200/50" />

              <button
                onClick={handleStart}
                disabled={isStarting}
                className={cn(
                  'w-full py-3.5 rounded-xl font-semibold text-white text-sm cursor-pointer',
                  'bg-gradient-to-r from-indigo-600 to-cyan-500',
                  'hover:from-indigo-500 hover:to-cyan-400',
                  'transition-all duration-200',
                  'flex items-center justify-center gap-2',
                  'shadow-lg shadow-indigo-600/20',
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
          )}

          {/* Tab 2: Pre-Interview Training */}
          {activeTab === 'training' && <TrainingPanel />}

          {/* Tab 3: Interview History & Review */}
          {activeTab === 'history' && <HistoryReviewPanel />}
        </div>

        {/* Hint */}
        {activeTab === 'setup' && (
          <p className="text-center text-xs text-slate-400 mt-5 font-medium">
            Press{' '}
            <kbd className="bg-slate-200/60 px-1.5 py-0.5 rounded text-slate-600 font-mono text-[11px] border border-slate-300/30">
              Ctrl+Shift+H
            </kbd>{' '}
            during interview to toggle stealth mode
          </p>
        )}
      </motion.div>
    </div>
  )
}

