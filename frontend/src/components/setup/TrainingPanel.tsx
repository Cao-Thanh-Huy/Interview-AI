import { useState, useCallback, useRef } from 'react'
import { Sparkles, Languages, Loader2 } from 'lucide-react'
import { streamCompletion, translateText } from '@/lib/api'
import { useInterviewStore } from '@/store/useInterviewStore'

export function TrainingPanel() {
  const context = useInterviewStore((s) => s.context)

  const [question, setQuestion] = useState('')
  const [draftAnswer, setDraftAnswer] = useState('')
  const [showTranslation, setShowTranslation] = useState(false)
  const [translatedAnswer, setTranslatedAnswer] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const lastTranslatedSourceRef = useRef('')
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleToggleTranslate = useCallback(async () => {
    if (showTranslation) { setShowTranslation(false); return }
    const sourceText = draftAnswer.trim()
    if (!sourceText) return
    if (translatedAnswer && sourceText === lastTranslatedSourceRef.current) {
      setShowTranslation(true); return
    }
    setIsTranslating(true)
    try {
      const result = await translateText(sourceText)
      setTranslatedAnswer(result)
      lastTranslatedSourceRef.current = sourceText
      setShowTranslation(true)
    } catch {
      // ignore
    } finally {
      setIsTranslating(false)
    }
  }, [showTranslation, draftAnswer, translatedAnswer])

  const handleGenerate = useCallback(async () => {
    if (!question.trim()) return
    setDraftAnswer('')
    setTranslatedAnswer('')
    setShowTranslation(false)
    lastTranslatedSourceRef.current = ''
    setIsGenerating(true)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    try {
      await streamCompletion(
        question.trim(), context, 'training',
        (chunk) => setDraftAnswer((prev) => prev + chunk),
        ctrl.signal,
      )
    } catch (err) {
      const error = err as Error
      if (error.name !== 'AbortError') {
        // ignore error toast for simplicity
      }
    } finally {
      setIsGenerating(false)
    }
  }, [question, context])

  return (
    <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', flex: 1 }}>

      {/* Step 1: Question */}
      <div style={{ marginBottom: 16 }}>
        <p className="label" style={{ marginBottom: 8 }}>Practice Question</p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Tell me about a time you handled a difficult stakeholder."
          rows={3}
          className="input-dark"
          style={{ fontFamily: 'inherit', resize: 'none' }}
        />
      </div>

      <div className="divider" />

      {/* Step 2: Generate */}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={handleGenerate}
          disabled={!question.trim() || isGenerating}
          className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
          style={{ opacity: (!question.trim() || isGenerating) ? 0.4 : 1 }}
        >
          {isGenerating
            ? <><Loader2 size={14} className="animate-spin" /> Generating…</>
            : <><Sparkles size={14} /> AI Draft Answer</>}
        </button>

        {(draftAnswer || isGenerating) && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label className="label">Draft Answer (edit as needed)</label>
              {draftAnswer && !isGenerating && (
                <button
                  onClick={handleToggleTranslate}
                  disabled={isTranslating}
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '3px 8px', opacity: isTranslating ? 0.5 : 1 }}
                >
                  {isTranslating ? <Loader2 size={11} className="animate-spin" /> : <Languages size={12} />}
                  {showTranslation ? 'English' : 'Dịch (VN)'}
                </button>
              )}
            </div>
            <textarea
              value={showTranslation ? translatedAnswer : draftAnswer}
              onChange={(e) => {
                if (showTranslation) setTranslatedAnswer(e.target.value)
                else setDraftAnswer(e.target.value)
              }}
              rows={8}
              placeholder={isGenerating ? 'AI is generating…' : 'Edit your answer here…'}
              className="input-dark"
              style={{ fontFamily: 'monospace', fontSize: 12, resize: 'vertical', minHeight: 140 }}
            />
          </div>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 16 }}>
        Practice answering questions. The AI generates draft answers based on your CV context to help you prepare.
      </p>
    </div>
  )
}
