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

  // --- Alias state ---
  const [suggestedAliases, setSuggestedAliases] = useState<SuggestedAlias[]>([])
  const [manualAliasInput, setManualAliasInput] = useState('')
  const [isSuggestingAliases, setIsSuggestingAliases] = useState(false)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3500)
  }

  // Tất cả alias phrases đã chọn (từ suggest + thêm tay)
  const allAliasPhrases = suggestedAliases.map((a) => a.phrase)

  const removeAlias = useCallback((phrase: string) => {
    setSuggestedAliases((prev) => prev.filter((a) => a.phrase !== phrase))
  }, [])

  const addManualAlias = useCallback(() => {
    const trimmed = manualAliasInput.trim()
    if (!trimmed || trimmed.length < 3) return
    if (allAliasPhrases.includes(trimmed)) return
    if (suggestedAliases.length >= ALIAS_MAX) return
    // Manual aliases không có impact info
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
    } catch (err) {
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
        ? `Knowledge updated! (${aliasCount} alias${aliasCount !== 1 ? 'es' : ''})`
        : `Saved! (${aliasCount} alias${aliasCount !== 1 ? 'es' : ''})`
      showToast('success', label)
    } catch (err) {
      showToast('error', (err as Error).message ?? 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [question, draftAnswer, translatedAnswer, showTranslation, allAliasPhrases])

  // Impact warning level cho 1 alias
  const getAliasWarningLevel = (alias: SuggestedAlias): 'warn' | 'note' | 'safe' => {
    if (!alias.impact || alias.impact.length === 0) return 'safe'
    const topScore = alias.impact[0].score
    if (topScore >= 0.85) return 'warn'
    if (topScore >= 0.80) return 'note'
    return 'safe'
  }

  return (
    <div className="space-y-5">
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
            {toast.type === 'success'
              ? <CheckCircle className="w-4 h-4 shrink-0" />
              : <AlertCircle className="w-4 h-4 shrink-0" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Question input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">❓ Practice Question</label>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Tell me about a time you handled a difficult stakeholder."
          rows={2}
          className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm placeholder:text-slate-400 resize-none outline-none focus:border-indigo-500/60 transition-all shadow-sm"
        />
      </div>

      {/* Alias Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-700">🔀 Aliases</label>
            <span className={cn(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              suggestedAliases.length >= ALIAS_MAX
                ? 'bg-amber-100 text-amber-700'
                : 'bg-slate-100 text-slate-500',
            )}>
              {suggestedAliases.length}/{ALIAS_MAX}
            </span>
          </div>
          <button
            onClick={handleSuggestAliases}
            disabled={!question.trim() || isSuggestingAliases || suggestedAliases.length >= ALIAS_MAX}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
              'bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isSuggestingAliases
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Scanning KB…</>
              : <><Wand2 className="w-3 h-3" /> Auto-suggest</>}
          </button>
        </div>

        {/* Alias chips */}
        <AnimatePresence mode="popLayout">
          {/* Loading skeleton */}
          {isSuggestingAliases && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-wrap gap-2"
            >
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-7 w-32 rounded-full bg-slate-200 animate-pulse" />
              ))}
            </motion.div>
          )}

          {/* Actual chips */}
          {!isSuggestingAliases && suggestedAliases.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex flex-wrap gap-2"
            >
              {suggestedAliases.map((alias) => {
                const warnLevel = getAliasWarningLevel(alias)
                const topImpact = alias.impact?.[0]

                return (
                  <motion.div
                    key={alias.phrase}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    layout
                    className="group relative"
                  >
                    <div className={cn(
                      'flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-xs font-medium border transition-all',
                      warnLevel === 'warn'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : warnLevel === 'note'
                        ? 'bg-yellow-50 text-yellow-800 border-yellow-200'
                        : 'bg-indigo-50 text-indigo-700 border-indigo-200',
                    )}>
                      {warnLevel === 'warn' && (
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                      )}
                      <span className="max-w-[180px] truncate">{alias.phrase}</span>
                      <button
                        onClick={() => removeAlias(alias.phrase)}
                        className={cn(
                          'ml-0.5 p-0.5 rounded-full transition-colors',
                          warnLevel === 'warn'
                            ? 'hover:bg-amber-200 text-amber-600'
                            : warnLevel === 'note'
                            ? 'hover:bg-yellow-200 text-yellow-600'
                            : 'hover:bg-indigo-200 text-indigo-500',
                        )}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Tooltip: retrieval impact warning */}
                    {topImpact && topImpact.score >= 0.80 && (
                      <div className="absolute bottom-full left-0 mb-1.5 z-20 hidden group-hover:block w-64">
                        <div className={cn(
                          'rounded-lg px-3 py-2 text-xs shadow-lg border',
                          warnLevel === 'warn'
                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                            : 'bg-yellow-50 border-yellow-200 text-yellow-800',
                        )}>
                          <p className="font-semibold mb-1">
                            {warnLevel === 'warn' ? '⚠️ High overlap' : '💡 Possible overlap'}
                          </p>
                          <p>
                            Similar to{' '}
                            <span className="font-medium">"{topImpact.phrase}"</span>{' '}
                            ({(topImpact.score * 100).toFixed(0)}% similar)
                          </p>
                          {topImpact.unitQuestion && (
                            <p className="text-[10px] mt-0.5 opacity-70">
                              In: "{topImpact.unitQuestion}"
                            </p>
                          )}
                          <p className="text-[10px] mt-1 opacity-60">
                            You can still keep this alias if intentional.
                          </p>
                        </div>
                        {/* Arrow */}
                        <div className={cn(
                          'w-2 h-2 rotate-45 border-r border-b ml-3 -mt-1',
                          warnLevel === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-yellow-50 border-yellow-200',
                        )} />
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual alias input */}
        {suggestedAliases.length < ALIAS_MAX && (
          <div className="flex gap-2">
            <input
              value={manualAliasInput}
              onChange={(e) => setManualAliasInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManualAlias() } }}
              placeholder="+ Add alias manually (Enter to add)"
              className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 text-xs placeholder:text-slate-400 outline-none focus:border-indigo-400/60 transition-all shadow-sm"
            />
            <button
              onClick={addManualAlias}
              disabled={!manualAliasInput.trim() || manualAliasInput.trim().length < 3}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}

        {suggestedAliases.length > 0 && (
          <p className="text-[11px] text-slate-400 leading-relaxed">
            🟢 Safe alias — 🟡 Note: possible overlap — 🟠 Warning: high similarity with existing KB. Hover for details.
            Aliases are saved <strong>only after</strong> you click Save.
          </p>
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!question.trim() || isGenerating}
        className={cn(
          'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200',
          'bg-indigo-600 text-white hover:bg-indigo-500',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'shadow-md shadow-indigo-600/20',
        )}
      >
        {isGenerating
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
          : <><Sparkles className="w-4 h-4" /> AI Draft Answer</>}
      </button>

      {/* Draft answer editor */}
      <AnimatePresence>
        {(draftAnswer || isGenerating) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">✏️ Edit &amp; Refine Answer</label>
              {draftAnswer && !isGenerating && (
                <button
                  onClick={handleToggleTranslate}
                  disabled={isTranslating}
                  className={cn(
                    'p-1 px-2.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold leading-none cursor-pointer border',
                    showTranslation
                      ? 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                      : 'text-slate-500 bg-slate-50 border-slate-200 hover:text-slate-700 hover:bg-slate-100',
                  )}
                  title={showTranslation ? 'Show English' : 'Dịch sang tiếng Việt'}
                >
                  {isTranslating
                    ? <Loader2 className="w-3 h-3 animate-spin text-indigo-500" />
                    : <Languages className="w-3.5 h-3.5" />}
                  <span>{showTranslation ? 'Gốc (English)' : 'Dịch (Vietnamese)'}</span>
                </button>
              )}
            </div>
            <textarea
              value={showTranslation ? translatedAnswer : draftAnswer}
              onChange={(e) => {
                if (showTranslation) setTranslatedAnswer(e.target.value)
                else setDraftAnswer(e.target.value)
              }}
              rows={10}
              placeholder={isGenerating ? 'AI is generating…' : 'Edit your answer here…'}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm resize-y outline-none focus:border-indigo-500/60 transition-all shadow-sm font-mono min-h-[160px]"
            />
            <button
              onClick={handleSave}
              disabled={(showTranslation ? !translatedAnswer.trim() : !draftAnswer.trim()) || isSaving}
              className={cn(
                'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200',
                'bg-emerald-600 text-white hover:bg-emerald-500',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'shadow-md shadow-emerald-600/20',
              )}
            >
              {isSaving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save to Knowledge Base{allAliasPhrases.length > 0 ? ` + ${allAliasPhrases.length} alias${allAliasPhrases.length !== 1 ? 'es' : ''}` : ''}</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved pairs this session */}
      {savedPairs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Saved this session ({savedPairs.length})
          </p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {savedPairs.map((pair) => (
              <div
                key={pair.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-xs space-y-1"
              >
                <p className="font-semibold text-slate-700 line-clamp-1">Q: {pair.question}</p>
                <p className="text-slate-500 line-clamp-2 whitespace-pre-line">{pair.answer}</p>
                {pair.aliasCount > 0 && (
                  <p className="text-indigo-500 text-[11px]">
                    + {pair.aliasCount} alias{pair.aliasCount !== 1 ? 'es' : ''} indexed
                  </p>
                )}
                <button
                  onClick={() => setSavedPairs((prev) => prev.filter((p) => p.id !== pair.id))}
                  className="flex items-center gap-1 text-red-400 hover:text-red-600 transition-colors text-[11px] mt-1"
                >
                  <Trash2 className="w-3 h-3" /> Remove from list
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 font-medium">
        Saved answers are semantically indexed with multi-alias retrieval. Use Auto-suggest to maximize coverage across different question phrasings.
      </p>
    </div>
  )
}
