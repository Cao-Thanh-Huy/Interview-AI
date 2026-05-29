import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, Save, Loader2, CheckCircle, AlertCircle,
  Trash2, Languages, Plus, X, Wand2, AlertTriangle,
} from 'lucide-react'
import { streamCompletion, upsertQA, translateText, suggestAliases } from '@/lib/api'
import { useInterviewStore } from '@/store/useInterviewStore'
import { cn } from '@/lib/utils'
import type { SuggestedAlias } from '@/lib/types'

const ALIAS_MAX = 8

interface TrainedPair {
  id: string
  question: string
  answer: string
  aliasCount: number
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#f1f5f9',
}

export function TrainingPanel() {
  const context = useInterviewStore((s) => s.context)

  const [question, setQuestion] = useState('')
  const [draftAnswer, setDraftAnswer] = useState('')
  const [showTranslation, setShowTranslation] = useState(false)
  const [translatedAnswer, setTranslatedAnswer] = useState('')
  const [isTranslating, setIsTranslating] = useState(false)
  const lastTranslatedSourceRef = useRef('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedPairs, setSavedPairs] = useState<TrainedPair[]>([])
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [suggestedAliases, setSuggestedAliases] = useState<SuggestedAlias[]>([])
  const [manualAliasInput, setManualAliasInput] = useState('')
  const [isSuggestingAliases, setIsSuggestingAliases] = useState(false)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  const allAliasPhrases = suggestedAliases.map((a) => a.phrase)

  const removeAlias = useCallback((phrase: string) => {
    setSuggestedAliases((prev) => prev.filter((a) => a.phrase !== phrase))
  }, [])

  const addManualAlias = useCallback(() => {
    const trimmed = manualAliasInput.trim()
    if (!trimmed || trimmed.length < 3) return
    if (allAliasPhrases.includes(trimmed)) return
    if (suggestedAliases.length >= ALIAS_MAX) return
    setSuggestedAliases((prev) => [...prev, { phrase: trimmed, impact: [] }])
    setManualAliasInput('')
  }, [manualAliasInput, allAliasPhrases, suggestedAliases.length])

  const handleSuggestAliases = useCallback(async () => {
    if (!question.trim() || isSuggestingAliases) return
    setIsSuggestingAliases(true)
    setSuggestedAliases([])
    try {
      const result = await suggestAliases(question.trim(), context)
      setSuggestedAliases(result.aliases.slice(0, ALIAS_MAX))
    } catch {
      showToast('error', 'Failed to suggest aliases')
    } finally {
      setIsSuggestingAliases(false)
    }
  }, [question, context, isSuggestingAliases])

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
      showToast('error', 'Translation failed')
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
      if (error.name !== 'AbortError') showToast('error', 'Failed to generate suggestion')
    } finally {
      setIsGenerating(false)
    }
  }, [question, context])

  const handleSave = useCallback(async () => {
    const finalAnswer = showTranslation ? translatedAnswer : draftAnswer
    if (!question.trim() || !finalAnswer.trim()) return
    setIsSaving(true)
    try {
      const result = await upsertQA(question.trim(), finalAnswer.trim(), allAliasPhrases)
      if (result.status === 'blocked_injection') {
        showToast('error', 'Input contains disallowed content')
        return
      }
      const aliasCount = 'aliases_saved' in result ? result.aliases_saved : 0
      setSavedPairs((prev) => [
        { id: `${Date.now()}`, question: question.trim(), answer: finalAnswer.trim(), aliasCount },
        ...prev,
      ])
      setQuestion('')
      setDraftAnswer('')
      setTranslatedAnswer('')
      setShowTranslation(false)
      lastTranslatedSourceRef.current = ''
      setSuggestedAliases([])
      setManualAliasInput('')
      const label = result.status === 'updated'
        ? `Knowledge updated! (${aliasCount} aliases)`
        : `Saved! (${aliasCount} aliases)`
      showToast('success', label)
    } catch (err) {
      showToast('error', (err as Error).message ?? 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [question, draftAnswer, translatedAnswer, showTranslation, allAliasPhrases])

  const getAliasWarningLevel = (alias: SuggestedAlias): 'warn' | 'note' | 'safe' => {
    if (!alias.impact || alias.impact.length === 0) return 'safe'
    const topScore = alias.impact[0].score
    if (topScore >= 0.85) return 'warn'
    if (topScore >= 0.80) return 'note'
    return 'safe'
  }

  // ── Step indicator circle ──────────────────────────────────────────────────
  const StepCircle = ({ n, withLine = true }: { n: number; withLine?: boolean }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(99,102,241,0.15)', border: '1.5px solid rgba(99,102,241,0.40)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, color: 'var(--primary)',
      }}>{n}</div>
      {withLine && <div style={{ width: 1.5, flex: 1, background: 'var(--line-2)', marginTop: 6 }} />}
    </div>
  )

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
          {toast.type === 'success' ? <CheckCircle className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* ── Step 1 — Question ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <StepCircle n={1} withLine={true} />
        <div style={{ flex: 1, paddingTop: 4 }}>
          <p className="label" style={{ marginBottom: 8 }}>Question</p>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Tell me about a time you handled a difficult stakeholder."
            rows={2}
            className="input-dark"
            style={{ fontFamily: 'inherit', resize: 'none' }}
          />
        </div>
      </div>

      <div className="divider" />

      {/* ── Step 2 — Aliases ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <StepCircle n={2} withLine={true} />
        <div style={{ flex: 1, paddingTop: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="label">Aliases</span>
              <span className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                suggestedAliases.length >= ALIAS_MAX
                  ? 'bg-amber-500/15 text-amber-400'
                  : 'bg-white/5 text-[var(--muted)]',
              )}>
                {suggestedAliases.length}/{ALIAS_MAX}
              </span>
            </div>
            <button
              onClick={handleSuggestAliases}
              disabled={!question.trim() || isSuggestingAliases || suggestedAliases.length >= ALIAS_MAX}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'rgba(139,92,246,0.12)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}
            >
              {isSuggestingAliases
                ? <><Loader2 className="w-3 h-3 animate-spin" /> Scanning…</>
                : <><Wand2 className="w-3 h-3" /> Auto-suggest</>}
            </button>
          </div>

          <AnimatePresence mode="popLayout">
            {isSuggestingAliases && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-wrap gap-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-7 w-32 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
                ))}
              </motion.div>
            )}
            {!isSuggestingAliases && suggestedAliases.length > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2">
                {suggestedAliases.map((alias) => {
                  const warnLevel = getAliasWarningLevel(alias)
                  return (
                    <motion.div
                      key={alias.phrase}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.85 }}
                      layout
                      className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-medium"
                      style={{
                        background: warnLevel === 'warn' ? 'rgba(245,158,11,0.12)' : warnLevel === 'note' ? 'rgba(234,179,8,0.1)' : 'rgba(99,102,241,0.12)',
                        border: `1px solid ${warnLevel === 'warn' ? 'rgba(245,158,11,0.25)' : warnLevel === 'note' ? 'rgba(234,179,8,0.2)' : 'rgba(99,102,241,0.25)'}`,
                        color: warnLevel === 'warn' ? '#fbbf24' : warnLevel === 'note' ? '#eab308' : '#818cf8',
                      }}
                    >
                      {warnLevel === 'warn' && <AlertTriangle className="w-3 h-3 shrink-0" />}
                      <span className="max-w-[180px] truncate">{alias.phrase}</span>
                      <button onClick={() => removeAlias(alias.phrase)} className="ml-0.5 p-0.5 rounded-full hover:bg-white/10 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>

          {suggestedAliases.length < ALIAS_MAX && (
            <div className="flex gap-2" style={{ marginTop: 8 }}>
              <input
                value={manualAliasInput}
                onChange={(e) => setManualAliasInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualAlias() } }}
                placeholder="+ Add alias manually (Enter to add)"
                className="flex-1 rounded-lg px-3 py-2 text-xs outline-none transition-all"
                style={{ ...inputStyle, fontSize: 12 }}
              />
              <button
                onClick={addManualAlias}
                disabled={!manualAliasInput.trim() || manualAliasInput.trim().length < 3}
                className="p-2 rounded-lg transition-colors disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="divider" />

      {/* ── Step 3 — Generate ── */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <StepCircle n={3} withLine={false} />
        <div style={{ flex: 1, paddingTop: 4 }}>
          <p className="label" style={{ marginBottom: 8 }}>Generate Answer</p>
          <button
            onClick={handleGenerate}
            disabled={!question.trim() || isGenerating}
            className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            style={{ opacity: (!question.trim() || isGenerating) ? 0.4 : 1 }}
          >
            {isGenerating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><Sparkles className="w-4 h-4" /> AI Draft Answer</>}
          </button>

          {(draftAnswer || isGenerating) && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label className="label">Edit &amp; Refine Answer</label>
                {draftAnswer && !isGenerating && (
                  <button
                    onClick={handleToggleTranslate}
                    disabled={isTranslating}
                    className="btn btn-ghost"
                    style={{ fontSize: 11, padding: '3px 8px', opacity: isTranslating ? 0.5 : 1 }}
                  >
                    {isTranslating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
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
              <button
                onClick={handleSave}
                disabled={(showTranslation ? !translatedAnswer.trim() : !draftAnswer.trim()) || isSaving}
                className="btn w-full py-2.5 flex items-center justify-center gap-2"
                style={{
                  background: 'var(--success)', color: 'white', borderRadius: 8, fontWeight: 600, fontSize: 13,
                  opacity: ((showTranslation ? !translatedAnswer.trim() : !draftAnswer.trim()) || isSaving) ? 0.4 : 1,
                }}
              >
                {isSaving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> Save to Knowledge Base{allAliasPhrases.length > 0 ? ` + ${allAliasPhrases.length} alias${allAliasPhrases.length !== 1 ? 'es' : ''}` : ''}</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Saved this session */}
      {savedPairs.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div className="divider" />
          <p className="label" style={{ marginBottom: 8 }}>Saved this session ({savedPairs.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 180, overflowY: 'auto' }}>
            {savedPairs.map((pair) => (
              <div
                key={pair.id}
                style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, padding: '8px 12px' }}
              >
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Q: {pair.question}</p>
                <p style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'pre-line', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{pair.answer}</p>
                {pair.aliasCount > 0 && (
                  <p style={{ fontSize: 11, color: 'var(--primary)', marginTop: 2 }}>+ {pair.aliasCount} aliases indexed</p>
                )}
                <button
                  onClick={() => setSavedPairs((prev) => prev.filter((p) => p.id !== pair.id))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--danger)', opacity: 0.6, marginTop: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        Saved answers are semantically indexed with multi-alias retrieval.
      </p>
    </div>
  )
}
