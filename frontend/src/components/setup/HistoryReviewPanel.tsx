import { useState, useEffect, useCallback, useMemo } from 'react'
import { RefreshCw, Loader2, ChevronDown, ChevronUp, Trash2, AlertTriangle } from 'lucide-react'
import { listHistory, getHistorySession, deleteHistorySession, clearAllHistory } from '@/lib/api'
import type { SessionMetadata, TurnEntry } from '@/lib/types'

export function HistoryReviewPanel() {
  const [sessions, setSessions] = useState<SessionMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [turns, setTurns] = useState<TurnEntry[]>([])
  const [loadingSession, setLoadingSession] = useState(false)

  // Confirm dialog state
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'clear'; sessionId?: string } | null>(null)

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
    } catch (err) {
      console.error('Failed to load session:', err)
    } finally {
      setLoadingSession(false)
    }
  }, [selectedId])

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await deleteHistorySession(sessionId)
      if (selectedId === sessionId) {
        setSelectedId(null)
        setTurns([])
      }
      await loadSessions()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
    setConfirmAction(null)
  }, [selectedId, loadSessions])

  const handleClearAll = useCallback(async () => {
    try {
      await clearAllHistory()
      setSelectedId(null)
      setTurns([])
      await loadSessions()
    } catch (err) {
      console.error('Failed to clear:', err)
    }
    setConfirmAction(null)
  }, [loadSessions])

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

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
          {sessions.length === 0 ? 'No sessions yet' : (
            <>{sessions.length} <span style={{ fontWeight: 400, color: 'var(--muted)' }}>session{sessions.length !== 1 ? 's' : ''} recorded</span></>
          )}
        </p>
        <div style={{ display: 'flex', gap: 6 }}>
          {sessions.length > 0 && (
            <button
              onClick={() => setConfirmAction({ type: 'clear' })}
              title="Delete all sessions"
              style={{
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                color: 'var(--danger)', background: 'rgba(244,63,94,0.08)',
                border: '1px solid rgba(244,63,94,0.2)',
                borderRadius: 6, padding: '4px 10px',
                cursor: 'pointer', fontWeight: 600,
              }}
            >
              <Trash2 size={12} />
              Clear all
            </button>
          )}
          <button
            onClick={loadSessions}
            disabled={loading}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
              color: 'var(--primary)', background: 'none', border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1, fontWeight: 600,
            }}
          >
            <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 6, fontSize: 12, color: 'var(--danger)', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Session list */}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.1em', whiteSpace: 'nowrap', opacity: 0.8 }}>
                  {formatDateGroup(daySessions[0].startedAt)}
                </p>
                <div style={{ flex: 1, height: 1, background: 'var(--line-2)' }} />
              </div>

              {daySessions.map((session) => (
                <div key={session.sessionId}>
                  <div
                    style={{
                      display: 'flex', alignItems: 'center',
                      borderRadius: selectedId === session.sessionId ? '0 8px 0 0' : '0 8px 8px 0',
                      borderLeft: selectedId === session.sessionId ? '2px solid var(--primary)' : '2px solid transparent',
                      transition: 'background 120ms ease-out',
                      background: selectedId === session.sessionId ? 'rgba(99,102,241,0.08)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (selectedId !== session.sessionId) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)' }}
                    onMouseLeave={e => { if (selectedId !== session.sessionId) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <button
                      onClick={() => handleSelectSession(session.sessionId)}
                      style={{
                        flex: 1, minWidth: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 8px 10px 16px',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        background: 'transparent',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {formatDate(session.startedAt)}
                          {session.type === 'practice' && (
                            <span style={{ fontSize: 9, color: '#eab308', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 3, padding: '1px 5px', fontWeight: 600, letterSpacing: '0.05em' }}>PRACTICE</span>
                          )}
                        </p>
                        {session.firstQuestion && (
                          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            🎤 {session.firstQuestion}
                          </p>
                        )}
                      </div>
                      {selectedId === session.sessionId
                        ? <ChevronUp size={14} color="var(--muted)" style={{ flexShrink: 0 }} />
                        : <ChevronDown size={14} color="var(--muted)" style={{ flexShrink: 0 }} />}
                    </button>

                    {/* Delete button — always visible nhẹ, sáng hơn khi hover */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmAction({ type: 'delete', sessionId: session.sessionId }) }}
                      title="Delete this session"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 28, height: 28, marginRight: 6, flexShrink: 0,
                        border: 'none', borderRadius: 6, cursor: 'pointer',
                        background: 'transparent',
                        color: 'rgba(244,63,94,0.35)',
                        opacity: 0.4,
                        transition: 'opacity 120ms, color 120ms, background 120ms',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)'; (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.1)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.4'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(244,63,94,0.35)'; (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

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
                          {turns.map((turn) => (
                            <div key={turn.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>🎤 {turn.question}</p>
                              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{turn.answer}</p>
                            </div>
                          ))}
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
        Sessions are stored locally on disk.
      </p>

      {/* ── Confirm dialog ────────────────────────────────────────────────── */}
      {confirmAction && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
          }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 12, padding: 24, maxWidth: 380, width: '90%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <AlertTriangle size={20} color="var(--danger)" />
              <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {confirmAction.type === 'clear' ? 'Clear all history?' : 'Delete this session?'}
              </p>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 20 }}>
              {confirmAction.type === 'clear'
                ? 'This will permanently delete all recorded sessions and turns. This action cannot be undone.'
                : 'This will permanently delete this session and all its turns. This action cannot be undone.'}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid var(--line)',
                  background: 'transparent', color: 'var(--text)', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (confirmAction.type === 'clear') handleClearAll()
                  else if (confirmAction.sessionId) handleDeleteSession(confirmAction.sessionId)
                }}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: 'var(--danger)', color: '#fff', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
