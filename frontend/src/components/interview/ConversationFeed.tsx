import { useEffect, useRef, memo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Sparkles, ChevronDown } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useInterviewStore } from '@/store/useInterviewStore'
import type { Turn } from '@/lib/types'

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const TurnItem = memo(function TurnItem({ turn }: { turn: Turn }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-5"
    >
      {/* Question */}
      <div className="flex items-start gap-2 mb-2">
        <span className="shrink-0 text-[10px] text-slate-400 mt-1 font-mono tabular-nums">
          {formatTimestamp(turn.timestamp)}
        </span>
        <div className="bg-slate-100/70 border border-slate-200/50 rounded-xl px-3 py-2 text-sm text-slate-800 leading-relaxed">
          {turn.question}
        </div>
      </div>

      {/* AI Answer */}
      {(turn.answer || turn.isGenerating) && (
        <div className="ml-[72px]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-4 h-4 rounded-md bg-indigo-500/10 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
            </div>
            {turn.isGenerating && (
              <div className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1 h-1 rounded-full bg-indigo-500/60 animate-bounce"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="border-l-2 border-indigo-500/20 pl-3">
            <div className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed
              [&>ul]:mt-1 [&>ul]:mb-0 [&>ul>li]:mt-0.5 [&>ul>li]:text-slate-600
              [&>p]:mt-0 [&>p]:mb-1">
              {/* Skip heavy ReactMarkdown while streaming — use plain text for speed */}
              {turn.isGenerating ? (
                <p className="whitespace-pre-wrap">{turn.answer}</p>
              ) : (
                <ReactMarkdown>{turn.answer}</ReactMarkdown>
              )}
            </div>
            {turn.isGenerating && (
              <span className="inline-block w-0.5 h-3.5 bg-indigo-500 animate-pulse rounded-full ml-0.5 align-middle" />
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
})

function LiveCaption() {
  const currentInterimCaption = useInterviewStore((s) => s.currentInterimCaption)

  if (!currentInterimCaption) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-start gap-2 mb-2"
    >
      <span className="shrink-0 text-[10px] text-slate-400 mt-1 font-mono">Now</span>
      <div className="bg-indigo-500/[0.04] border border-indigo-500/10 rounded-xl px-3 py-2 text-sm text-indigo-600/70 italic leading-relaxed">
        {currentInterimCaption}
        <span className="inline-block w-0.5 h-3.5 bg-indigo-500/50 animate-pulse rounded-full ml-0.5 align-middle" />
      </div>
    </motion.div>
  )
}

export function ConversationFeed() {
  const turns = useInterviewStore((s) => s.turns)
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false)

  // Smart Auto-Scroll with Passive Listeners
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const { scrollTop, scrollHeight, clientHeight } = container
          // If user is within 80px of the bottom, enable auto-scroll
          const isNearBottom = scrollHeight - scrollTop - clientHeight < 80
          autoScrollRef.current = isNearBottom
          if (isNearBottom) {
            setHasUnreadBelow(false)
          }
          ticking = false
        })
        ticking = true
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Auto scroll ONLY on new turns and if user is already near bottom
  useEffect(() => {
    if (autoScrollRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      })
    } else if (turns.length > 0) {
      // User scrolled up to read: alert them of new entries below!
      setHasUnreadBelow(true)
    }
  }, [turns])

  const handleScrollToBottom = () => {
    autoScrollRef.current = true
    setHasUnreadBelow(false)
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }

  const isEmpty = turns.length === 0

  return (
    <div className="glass rounded-2xl flex flex-col overflow-hidden h-full relative">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-slate-200/50 bg-white/30">
        <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center">
          <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
        </div>
        <h2 className="text-sm font-semibold text-slate-800">Interview</h2>
        {turns.length > 0 && (
          <span className="ml-auto text-xs text-slate-400 tabular-nums bg-slate-200/60 px-1.5 py-0.5 rounded-full font-mono">{turns.length}</span>
        )}
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 min-h-0 scroll-thin bg-white/10"
      >
        {isEmpty ? (
          <div className="h-full flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200/50 flex items-center justify-center mx-auto">
                <MessageSquare className="w-5 h-5 text-slate-300" />
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Interviewer's questions appear here
                <br />
                with AI suggestions below each one
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <AnimatePresence initial={false}>
              {turns.map((turn) => (
                <TurnItem key={turn.id} turn={turn} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Live isolated interim caption */}
        <LiveCaption />
      </div>

      {/* Floating Smart Scroll Badge */}
      <AnimatePresence>
        {hasUnreadBelow && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            onClick={handleScrollToBottom}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-full shadow-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-indigo-500/20 z-20"
          >
            <span>New suggestions below</span>
            <ChevronDown className="w-3 h-3 animate-bounce" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
