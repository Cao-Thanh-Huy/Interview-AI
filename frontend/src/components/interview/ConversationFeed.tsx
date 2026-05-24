import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Sparkles } from 'lucide-react'
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

function TurnItem({ turn }: { turn: Turn }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mb-5"
    >
      {/* Question */}
      <div className="flex items-start gap-2 mb-2">
        <span className="shrink-0 text-[10px] text-white/25 mt-1 font-mono tabular-nums">
          {formatTimestamp(turn.timestamp)}
        </span>
        <div className="bg-white/[0.06] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-white/80 leading-relaxed">
          {turn.question}
        </div>
      </div>

      {/* AI Answer */}
      {(turn.answer || turn.isGenerating) && (
        <div className="ml-[72px]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-4 h-4 rounded-md bg-violet-500/20 flex items-center justify-center">
              <Sparkles className="w-2.5 h-2.5 text-violet-400" />
            </div>
            {turn.isGenerating && (
              <div className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1 h-1 rounded-full bg-violet-400/70 animate-bounce"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="border-l-2 border-violet-500/25 pl-3">
            <div className="prose prose-invert prose-sm max-w-none text-white/70 leading-relaxed
              [&>ul]:mt-1 [&>ul]:mb-0 [&>ul>li]:mt-0.5 [&>ul>li]:text-white/70
              [&>p]:mt-0 [&>p]:mb-1">
              <ReactMarkdown>{turn.answer}</ReactMarkdown>
            </div>
            {turn.isGenerating && (
              <span className="inline-block w-0.5 h-3.5 bg-violet-400 animate-pulse rounded-full ml-0.5 align-middle" />
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}

export function ConversationFeed() {
  const { turns, currentInterimCaption } = useInterviewStore()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns, currentInterimCaption])

  const isEmpty = turns.length === 0 && !currentInterimCaption

  return (
    <div className="glass rounded-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <div className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <h2 className="text-sm font-semibold text-white/80">Interview</h2>
        {turns.length > 0 && (
          <span className="ml-auto text-xs text-white/25 tabular-nums">{turns.length}</span>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0 scroll-thin">
        {isEmpty ? (
          <div className="h-full flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center mx-auto">
                <MessageSquare className="w-5 h-5 text-white/15" />
              </div>
              <p className="text-xs text-white/20 leading-relaxed">
                Interviewer's questions appear here
                <br />
                with AI suggestions below each one
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {turns.map((turn) => (
              <TurnItem key={turn.id} turn={turn} />
            ))}
          </AnimatePresence>
        )}

        {/* Live interim caption */}
        {currentInterimCaption && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-start gap-2 mb-2"
          >
            <span className="shrink-0 text-[10px] text-white/15 mt-1 font-mono">Now</span>
            <div className="bg-cyan-500/[0.05] border border-cyan-500/10 rounded-xl px-3 py-2 text-sm text-cyan-300/60 italic leading-relaxed">
              {currentInterimCaption}
              <span className="inline-block w-0.5 h-3.5 bg-cyan-400/50 animate-pulse rounded-full ml-0.5 align-middle" />
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}
