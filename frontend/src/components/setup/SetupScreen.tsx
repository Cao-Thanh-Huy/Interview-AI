import { useState } from 'react'
import { motion } from 'framer-motion'
import { Zap, Mic, Dumbbell, History, BrainCircuit } from 'lucide-react'
import { TrainingPanel } from './TrainingPanel'
import { HistoryReviewPanel } from './HistoryReviewPanel'
import { MockInterviewPanel } from './MockInterviewPanel'
import { useInterviewStore } from '@/store/useInterviewStore'
import { cn } from '@/lib/utils'

type Tab = 'setup' | 'training' | 'history' | 'mock'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'setup',    label: 'Setup Session',         icon: <Zap className="w-3.5 h-3.5" /> },
  { id: 'training', label: 'Pre-Interview Training', icon: <Dumbbell className="w-3.5 h-3.5" /> },
  { id: 'history',  label: 'Interview History',      icon: <History className="w-3.5 h-3.5" /> },
  { id: 'mock',     label: 'Mock Interview',          icon: <BrainCircuit className="w-3.5 h-3.5" /> },
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
        className={cn(
          "relative z-10 w-full transition-all duration-300 ease-in-out",
          activeTab === 'setup' ? 'max-w-lg' : 'max-w-4xl'
        )}
      >
        {/* Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-cyan-500 shadow-xl shadow-indigo-500/20 mb-5 animate-pulse">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2 tracking-tight">IntelliView</h1>
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
            <div className="space-y-6 text-center py-4">
              {/* Animated Listening/Mic Signal Visual */}
              <div className="relative flex items-center justify-center w-24 h-24 mx-auto mb-2">
                {/* Outer pulsing ring */}
                <div className="absolute inset-0 rounded-full bg-indigo-500/10 animate-ping" />
                {/* Inner pulsing ring */}
                <div className="absolute w-16 h-16 rounded-full bg-indigo-500/20 animate-pulse" />
                {/* Center Core Circle with Icon */}
                <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                  <Mic className="w-5 h-5 text-white" />
                </div>
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider">AI READY</span>
              </div>

              {/* Core Description */}
              <div className="max-w-xs mx-auto space-y-2">
                <h3 className="text-base font-semibold text-slate-800">Start IntelliView</h3>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  The system will automatically listen to your interview and query the pre-trained SQLite Knowledge Base to generate real-world senior level suggestions.
                </p>
              </div>

              <div className="border-t border-slate-100" />

              <button
                onClick={handleStart}
                disabled={isStarting}
                className={cn(
                  'w-full py-4 rounded-xl font-bold text-white text-sm cursor-pointer',
                  'bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600',
                  'hover:from-indigo-500 hover:via-indigo-600 hover:to-cyan-500',
                  'active:scale-[0.98]',
                  'transition-all duration-200',
                  'flex items-center justify-center gap-2',
                  'shadow-lg shadow-indigo-600/25',
                  'disabled:opacity-60 disabled:cursor-not-allowed',
                )}
              >
                {isStarting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Initializing...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Launch Interview Session
                  </>
                )}
              </button>
            </div>
          )}

          {/* Tab 2: Pre-Interview Training */}
          {activeTab === 'training' && <TrainingPanel />}

          {/* Tab 3: Interview History & Review */}
          {activeTab === 'history' && <HistoryReviewPanel />}

          {/* Tab 4: Mock Interview */}
          {activeTab === 'mock' && <MockInterviewPanel />}
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

