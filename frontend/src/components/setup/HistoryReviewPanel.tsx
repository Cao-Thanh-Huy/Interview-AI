import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, ChevronDown, ChevronUp, Brain, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { listHistory, getHistorySession, upsertQA } from '@/lib/api'
import type { SessionMetadata, TurnEntry } from '@/lib/types'
import { cn } from '@/lib/utils'

export function HistoryReviewPanel() {
  const [sessions, setSessions] = useState<SessionMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [turns, setTurns] = useState<TurnEntry[]>([])
  const [loadingSession, setLoadingSession] = useState(false)

  const [savingTurnId, setSavingTurnId] = useState<string | null>(null)
  const [savedTurnIds, setSavedTurnIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { sessions: list } = await listHistory()
      setSessions(list)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (selectedId === sessionId) {
      setSelectedId(null)
      setTurns([])
      return
    }
    setSelectedId(sessionId)
    setLoadingSession(true)
    try {
      const data = await getHistorySession(sessionId)
      setTurns(data.turns)
      setSavedTurnIds(new Set())
    } catch (err) {
      showToast('error', (err as Error).message)
    } finally {
      setLoadingSession(false)
    }
  }, [selectedId])

  const handleMemorize = useCallback(async (turn: TurnEntry) => {
    setSavingTurnId(turn.id)
    try {
      const result = await upsertQA(turn.question, turn.answer)
      if (result.status === 'blocked_injection') {
        showToast('error', 'Content flagged by injection guard')
        return
      }
      setSavedTurnIds((prev) => new Set([...prev, turn.id]))
      const label = result.status === 'updated' ? 'Knowledge updated!' : 'Memorized! ✓'
      showToast('success', label)
    } catch (err) {
      showToast('error', (err as Error).message)
    } finally {
      setSavingTurnId(null)
    }
  }, [])

  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      }).format(new Date(iso))
    } catch {
      return iso
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium',
              toast.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-700 border border-red-500/20',
            )}
          >
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {sessions.length === 0 ? 'No sessions recorded yet.' : `${sessions.length} session(s) on disk`}
        </p>
        <button
          onClick={loadSessions}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-500 font-medium transition-colors"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Session list */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {sessions.map((session) => (
          <div key={session.sessionId} className="rounded-xl border border-slate-200 overflow-hidden">
            {/* Session header row */}
            <button
              onClick={() => handleSelectSession(session.sessionId)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
            >
              <div>
                <p className="text-sm font-semibold text-slate-800">{formatDate(session.startedAt)}</p>
                {session.context && (
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{session.context}</p>
                )}
              </div>
              {selectedId === session.sessionId ? (
                <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              )}
            </button>

            {/* Turns */}
            <AnimatePresence>
              {selectedId === session.sessionId && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-100 overflow-hidden"
                >
                  {loadingSession ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                    </div>
                  ) : turns.length === 0 ? (
                    <p className="text-xs text-slate-400 px-4 py-4">No turns recorded for this session.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {turns.map((turn) => {
                        const isSaved = savedTurnIds.has(turn.id)
                        const isSaving = savingTurnId === turn.id
                        return (
                          <div key={turn.id} className="px-4 py-3 space-y-2">
                            <p className="text-xs font-semibold text-slate-600">
                              🎤 {turn.question}
                            </p>
                            <p className="text-xs text-slate-500 whitespace-pre-line leading-relaxed">
                              {turn.answer}
                            </p>
                            <button
                              onClick={() => handleMemorize(turn)}
                              disabled={isSaved || isSaving}
                              className={cn(
                                'flex items-center gap-1.5 text-[11px] font-semibold rounded-lg px-3 py-1.5 transition-all',
                                isSaved
                                  ? 'bg-emerald-100 text-emerald-700 cursor-default'
                                  : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200',
                                isSaving && 'opacity-60',
                              )}
                            >
                              {isSaving ? (
                                <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</>
                              ) : isSaved ? (
                                <><CheckCircle className="w-3 h-3" /> Memorized</>
                              ) : (
                                <><Brain className="w-3 h-3" /> Memorize</>
                              )}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 font-medium">
        Sessions are stored locally on disk. "Memorize" promotes a turn to the permanent Local knowledge base.
      </p>
    </div>
  )
}
