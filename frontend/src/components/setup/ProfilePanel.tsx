import { useState, useRef, useCallback } from 'react'
import { Save, Loader2, CheckCircle, AlertCircle, Edit3, Trash2, X, RotateCcw } from 'lucide-react'
import { compressText } from '@/lib/api'
import { useInterviewStore } from '@/store/useInterviewStore'

const MAX_PROFILE_CHARS = 5000
const BACKUP_KEY = 'profile-backup'

export function ProfilePanel() {
  const storeContext = useInterviewStore((s) => s.context)
  const setContext = useInterviewStore((s) => s.setContext)

  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view')
  const [editText, setEditText] = useState('')
  const [isCompressing, setIsCompressing] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = (type: 'success' | 'error', msg: string) => {
    clearTimeout(toastTimer.current)
    setToast({ type, msg })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const hasProfile = storeContext.trim().length > 0
  const profileChars = storeContext.length
  const isOverLimit = profileChars > MAX_PROFILE_CHARS
  const hasBackup = !!localStorage.getItem(BACKUP_KEY)

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const doSave = useCallback((text: string) => {
    setContext(text)
    setViewMode('view')
    setEditText('')
  }, [setContext])

  // ── Edit ────────────────────────────────────────────────────────────────────
  const handleEdit = () => {
    setEditText(storeContext)
    setViewMode('edit')
  }

  const handleSaveEdit = async () => {
    const trimmed = editText.trim()
    if (!trimmed) return

    if (trimmed.length > MAX_PROFILE_CHARS) {
      // Backup bản CŨ (trước khi chỉnh sửa) — không phải text mới
      if (hasProfile) localStorage.setItem(BACKUP_KEY, storeContext)
      else localStorage.setItem(BACKUP_KEY, trimmed)
      setIsCompressing(true)
      try {
        const compressed = await compressText(trimmed)
        if (compressed && compressed.length > 100) {
          doSave(compressed)
          showToast('success', `✅ Compressed from ${trimmed.length.toLocaleString()} to ${compressed.length.toLocaleString()} chars`)
        } else {
          doSave(trimmed)
          showToast('success', `✅ Saved (${trimmed.length.toLocaleString()} chars, exceeds limit)`)
        }
      } catch {
        doSave(trimmed)
        showToast('error', 'Compression failed, saved original text')
      } finally {
        setIsCompressing(false)
      }
    } else {
      // Xóa backup nếu text đã ngắn lại
      if (hasBackup) localStorage.removeItem(BACKUP_KEY)
      doSave(trimmed)
      showToast('success', `✅ Profile saved (${trimmed.length.toLocaleString()} chars)`)
    }
  }

  const handleCancelEdit = () => {
    setViewMode('view')
    setEditText('')
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = () => {
    setContext('')
    localStorage.removeItem(BACKUP_KEY)
    showToast('success', '🗑️ Profile cleared!')
  }

  // ── Restore ─────────────────────────────────────────────────────────────────
  const handleRestore = () => {
    const backup = localStorage.getItem(BACKUP_KEY)
    if (backup) {
      setContext(backup)
      showToast('success', `✅ Restored previous version (${backup.length.toLocaleString()} chars)`)
    }
  }

  const charColor = isOverLimit ? '#f43f5e' : profileChars > 4000 ? '#eab308' : '#10b981'
  const editCharColor = editText.length > MAX_PROFILE_CHARS ? '#f43f5e' : editText.length > 4000 ? '#eab308' : '#10b981'

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', flex: 1 }}>

      {/* Toast */}
      {toast && (
        <div className="animate-panel" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
          marginBottom: 16,
          ...(toast.type === 'success'
            ? { background: 'rgba(16,185,129,0.10)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
            : { background: 'rgba(244,63,94,0.10)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)' })
        }}>
          {toast.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {toast.msg}
        </div>
      )}

      {/* ── View mode ─────────────────────────────────────────────────────────── */}
      {hasProfile && viewMode === 'view' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Status bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', borderRadius: 8,
            background: isOverLimit ? 'rgba(244,63,94,0.08)' : 'rgba(16,185,129,0.08)',
            border: `1px solid ${isOverLimit ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isOverLimit ? <AlertCircle size={14} color="#f43f5e" /> : <CheckCircle size={14} color="#10b981" />}
              <span style={{ fontSize: 12, fontWeight: 500, color: charColor }}>
                {profileChars.toLocaleString()} / {MAX_PROFILE_CHARS.toLocaleString()} chars
                {isOverLimit && (
                  <span style={{ color: '#f43f5e', marginLeft: 8 }}>— exceeds limit</span>
                )}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleEdit} title="Edit profile"
                style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                  color: '#a5b4fc', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Edit3 size={11} /> Edit
              </button>
              <button onClick={handleDelete} title="Delete profile"
                style={{ padding: '4px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.2)',
                  color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>

          {/* Profile content */}
          <div style={{
            padding: 12, borderRadius: 8, background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--line)', fontSize: 12, lineHeight: 1.6,
            color: 'var(--text-2)', whiteSpace: 'pre-wrap', maxHeight: 400,
            overflowY: 'auto',
          }}>
            {storeContext}
          </div>

          {/* Restore backup */}
          {hasBackup && (
            <button onClick={handleRestore}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)',
                color: '#eab308', alignSelf: 'flex-start', }}>
              <RotateCcw size={12} /> Restore previous version
            </button>
          )}
        </div>
      )}

      {/* ── Edit mode ─────────────────────────────────────────────────────────── */}
      {hasProfile && viewMode === 'edit' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: editCharColor }}>
              {editText.length.toLocaleString()} / {MAX_PROFILE_CHARS.toLocaleString()} chars
              {editText.length > MAX_PROFILE_CHARS && (
                <span style={{ color: '#f43f5e', marginLeft: 8 }}>— will be compressed</span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleSaveEdit} disabled={!editText.trim() || isCompressing}
                style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)',
                  color: '#a5b4fc', opacity: (!editText.trim() || isCompressing) ? 0.4 : 1,
                  display: 'flex', alignItems: 'center', gap: 4 }}>
                {isCompressing ? <><Loader2 size={12} className="animate-spin" /> Compressing...</> : <><Save size={12} /> Save</>}
              </button>
              <button onClick={handleCancelEdit} disabled={isCompressing}
                style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: 'transparent', border: '1px solid var(--line)',
                  color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4,
                  opacity: isCompressing ? 0.4 : 1 }}>
                <X size={12} /> Cancel
              </button>
            </div>
          </div>
          <textarea value={editText} onChange={e => setEditText(e.target.value)}
            rows={16} className="input-dark" autoFocus
            style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical', minHeight: 300 }} />
        </div>
      )}

      {/* ── No profile — write directly ────────────────────────────────────────── */}
      {!hasProfile && viewMode === 'view' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
            color: '#f43f5e', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <AlertCircle size={14} />
            No profile set — write your profile below or paste it in
          </div>
          <textarea value={editText} onChange={e => setEditText(e.target.value)}
            placeholder="Write or paste your profile here... (plain text)"
            rows={14} className="input-dark"
            style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical', minHeight: 280 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: editText.length > MAX_PROFILE_CHARS ? '#f43f5e' : '#10b981' }}>
              {editText.length.toLocaleString()} / {MAX_PROFILE_CHARS.toLocaleString()} chars
              {editText.length > MAX_PROFILE_CHARS && (
                <span style={{ color: '#f43f5e', marginLeft: 8 }}>— will be compressed</span>
              )}
            </span>
            <button onClick={handleSaveEdit} disabled={!editText.trim() || isCompressing}
              className="btn btn-primary"
              style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, opacity: (!editText.trim() || isCompressing) ? 0.4 : 1 }}>
              {isCompressing ? <><Loader2 size={14} className="animate-spin" /> Compressing...</> : <><Save size={14} /> Save Profile</>}
            </button>
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16 }}>
        Max {MAX_PROFILE_CHARS.toLocaleString()} chars. Auto-compressed if exceeded (previous version backed up).
      </p>
    </div>
  )
}
