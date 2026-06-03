import { useState, useRef } from 'react'
import { Sparkles, Save, Loader2, CheckCircle, AlertCircle, FileText, Trash2 } from 'lucide-react'
import { processCV } from '@/lib/api'
import { useInterviewStore } from '@/store/useInterviewStore'

export function ProfilePanel() {
  const setContext = useInterviewStore((s) => s.setContext)
  const storeContext = useInterviewStore((s) => s.context)

  const [cvText, setCvText] = useState('')
  const [summary, setSummary] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'processing' | 'ready' | 'error'>('idle')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const showToast = (type: 'success' | 'error', msg: string) => {
    clearTimeout(toastTimer.current)
    setToast({ type, msg })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  const handleProcess = async () => {
    if (!cvText.trim()) return
    setIsProcessing(true)
    setStatus('processing')
    setSummary('')
    try {
      // Nếu đã có context → merge, nếu chưa → summary mới
      const existingContext = storeContext.trim() || ''
      const result = await processCV(cvText.trim(), existingContext || undefined)
      setSummary(result.summary)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      showToast('error', (err as Error).message || 'Failed to process CV')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSave = () => {
    const toSave = summary || cvText
    if (!toSave.trim()) return
    console.log('[Profile] Saving context:', toSave.substring(0, 100) + '...')
    setContext(toSave.trim())
    showToast('success', '✅ Context saved! (' + toSave.split('\n').length + ' lines)')
  }

  const handleClear = () => {
    setContext('')
    setCvText('')
    setSummary('')
    setStatus('idle')
    showToast('success', '🗑️ Context cleared!')
  }

  const hasExistingContext = storeContext.trim().length > 0

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', flex: 1 }}>

      {/* Toast */}
      {toast && (
        <div
          className="animate-panel"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
            marginBottom: 16,
            ...(toast.type === 'success'
              ? { background: 'rgba(16,185,129,0.10)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }
              : { background: 'rgba(244,63,94,0.10)', color: '#f43f5e', border: '1px solid rgba(244,63,94,0.2)' })
          }}
        >
          {toast.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
          {toast.msg}
        </div>
      )}

      {/* Current context status */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
        marginBottom: 16,
        background: hasExistingContext ? 'rgba(16,185,129,0.08)' : 'rgba(244,63,94,0.08)',
        border: `1px solid ${hasExistingContext ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
        color: hasExistingContext ? '#10b981' : '#f43f5e',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {hasExistingContext ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
          {hasExistingContext
            ? `Context ready (${storeContext.split('\n').length} lines)`
            : 'No context set — paste your CV below'}
        </div>
        {hasExistingContext && (
          <button
            onClick={handleClear}
            title="Clear all context"
            style={{
              background: 'rgba(244,63,94,0.15)',
              border: 'none',
              color: '#f43f5e',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Trash2 size={12} /> Clear
          </button>
        )}
      </div>

      {/* Step 1: Paste CV */}
      <div style={{ marginBottom: 16 }}>
        <p className="label" style={{ marginBottom: 8 }}>
          <FileText size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Paste your CV here
        </p>
        <textarea
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          placeholder="Ctrl+V your CV here... (plain text, from any format)"
          rows={10}
          className="input-dark"
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            resize: 'vertical',
            minHeight: 160,
          }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          onClick={handleProcess}
          disabled={!cvText.trim() || isProcessing}
          className="btn btn-primary"
          style={{
            flex: 1,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            opacity: (!cvText.trim() || isProcessing) ? 0.4 : 1,
          }}
        >
          {isProcessing ? (
            <><Loader2 size={14} className="animate-spin" /> {hasExistingContext ? 'Merging...' : 'AI is reading your CV...'}</>
          ) : (
            <><Sparkles size={14} /> {hasExistingContext ? 'Process to Merge' : 'Process with AI'}</>
          )}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!cvText.trim()}
          className="btn btn-primary"
          style={{
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            opacity: !cvText.trim() ? 0.4 : 1,
          }}
        >
          <Save size={14} />
          Save Context
        </button>
      </div>

      {/* AI Summary */}
      {(summary || status === 'processing') && (
        <>
          <div className="divider" />
          <div style={{ marginTop: 16 }}>
            <p className="label" style={{ marginBottom: 8 }}>
              {status === 'processing' ? 'AI is summarizing...' : 'AI Summary (editable)'}
            </p>
            {status === 'processing' ? (
              <div style={{
                padding: 16,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--line)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: 'var(--muted)',
              }}>
                <Loader2 size={14} className="animate-spin" />
                Reading your CV and extracting key information...
              </div>
            ) : (
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={12}
                className="input-dark"
                style={{
                  fontFamily: 'monospace',
                  fontSize: 12,
                  resize: 'vertical',
                  minHeight: 200,
                }}
              />
            )}
          </div>
        </>
      )}

      {/* Error state */}
      {status === 'error' && (
        <div style={{
          marginTop: 8,
          padding: '8px 12px', borderRadius: 6, fontSize: 12,
          background: 'rgba(244,63,94,0.08)',
          border: '1px solid rgba(244,63,94,0.2)',
          color: '#f43f5e',
        }}>
          Failed to process CV. Check your API key and try again.
          <button
            onClick={handleProcess}
            style={{
              marginLeft: 8,
              background: 'none', border: 'none', color: 'var(--primary)',
              cursor: 'pointer', fontWeight: 600, fontSize: 12,
              textDecoration: 'underline',
            }}
          >
            Retry
          </button>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16 }}>
        Your CV context is saved locally and sent with every interview question.
        The AI reads it to give you personalized answers.
      </p>
    </div>
  )
}
