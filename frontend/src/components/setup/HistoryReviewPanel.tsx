import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Brain, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp } from 'lucide-react'
import { listHistory, getHistorySession, upsertQA } from '@/lib/api'
import type { SessionMetadata, TurnEntry } from '@/lib/types'

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

  useEffect(() => { loadSessions() }, [loadSessions])

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
      showToast('success', result.status === 'updated' ? 'Knowledge updated!' : 'Memorized! ✓')
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
    } catch { return iso }
  }

  const formatDateGroup = (iso: string) => {
    try {
      return new Intl.DateTimeFormat('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      }).format(new Date(iso)).toUpperCase()
    } catch { return iso }
  }

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const groups: Record<string, SessionMetadata[]> = {}
    sessions.forEach((s) => {
      const dateKey = s.startedAt ? new Date(s.startedAt).toDateString() : 'Unknown'
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(s)
    })
    return Object.entries(groups)
  }, [sessions])

  return (
    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', flex: 1 }}>
      {/* Toast */}
      {toast && (
        <div
          className="animate-panel"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            marginBottom: 12,
            ...(toast.type === 'success'
              ? { background: 'rgba(16,185,129,0.10)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
              : { background: 'rgba(244,63,94,0.10)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)' })
          }}
        >
          {toast.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {toast.msg}
        </div>
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {sessions.length === 0 ? 'No sessions yet' : (
            <>{sessions.length} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>session{sessions.length !== 1 ? 's' : ''} recorded</span></>
          )}
        </p>
        <button
          onClick={loadSessions}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontWeight: 600 }}
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, color: 'var(--danger)', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Date-grouped session list */}
      {groupedSessions.length === 0 && !loading ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 32, opacity: 0.3 }}>📋</div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>No sessions recorded yet</p>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Start a session to begin building your history</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {groupedSessions.map(([dateKey, daySessions]) => (
            <div key={dateKey}>
              {/* Date group header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.1em', whiteSpace: 'nowrap', opacity: 0.8 }}>
                  {formatDateGroup(daySessions[0].startedAt)}
                </p>
                <div style={{ flex: 1, height: 1, background: 'var(--line-2)' }} />
              </div>

              {/* Session rows */}
              {daySessions.map((session) => (
                <div key={session.sessionId}>
                  <button
                    onClick={() => handleSelectSession(session.sessionId)}
                    style={{
                      width: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px 10px 16px',
                      background: selectedId === session.sessionId ? 'rgba(99,102,241,0.08)' : 'transparent',
                      border: 'none',
                      borderLeft: selectedId === session.sessionId ? '2px solid var(--primary)' : '2px solid transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      borderRadius: '0 8px 8px 0',
                      transition: 'background 120ms ease-out, border-color 120ms ease-out',
                    }}
                    onMouseEnter={e => { if (selectedId !== session.sessionId) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { if (selectedId !== session.sessionId) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
                        {formatDate(session.startedAt)}
                      </p>
                      {(session.context || session.firstQuestion) && (
                        <p style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                          {session.context
                            ? session.context
                            : (session.firstQuestion!.length > 80
                                ? session.firstQuestion!.slice(0, 80) + '…'
                                : session.firstQuestion)}
                        </p>
                      )}
                    </div>
                    {selectedId === session.sessionId
                      ? <ChevronUp size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
                      : <ChevronDown size={14} color="var(--muted)" style={{ flexShrink: 0 }} />}
                  </button>

                  {/* Expanded turns */}
                  {selectedId === session.sessionId && (
                    <div className="animate-panel" style={{ borderTop: '1px solid var(--line)', marginTop: 0 }}>
                      {loadingSession ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                          <Loader2 size={16} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                        </div>
                      ) : turns.length === 0 ? (
                        <p style={{ fontSize: 12, padding: '12px', color: 'var(--muted)' }}>No turns recorded for this session.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          {turns.map((turn) => {
                            const isSaved = savedTurnIds.has(turn.id)
                            const isSavingThis = savingTurnId === turn.id
                            return (
                              <div key={turn.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>🎤 {turn.question}</p>
                                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{turn.answer}</p>
                                <button
                                  onClick={() => handleMemorize(turn)}
                                  disabled={isSaved || isSavingThis}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 5,
                                    fontSize: 11, fontWeight: 600,
                                    padding: '4px 10px', borderRadius: 6,
                                    border: 'none', cursor: isSaved ? 'default' : 'pointer',
                                    alignSelf: 'flex-start',
                                    opacity: isSavingThis ? 0.6 : 1,
                                    transition: 'background 120ms ease-out',
                                    ...(isSaved
                                      ? { background: 'rgba(16,185,129,0.12)', color: '#10b981' }
                                      : { background: 'rgba(99,102,241,0.12)', color: '#818cf8' })
                                  }}
                                >
                                  {isSavingThis ? (
                                    <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
                                  ) : isSaved ? (
                                    <><CheckCircle size={11} /> Memorized</>
                                  ) : (
                                    <><Brain size={11} /> Memorize</>
                                  )}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16 }}>
        Sessions are stored locally on disk. “Memorize” promotes a turn to the permanent knowledge base.
      </p>
    </div>
  )
}
