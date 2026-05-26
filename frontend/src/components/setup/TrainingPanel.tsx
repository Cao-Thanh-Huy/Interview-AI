import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Save, Loader2, CheckCircle, AlertCircle, Trash2 } from 'lucide-react'
import { streamCompletion, upsertQA } from '@/lib/api'
import { useInterviewStore } from '@/store/useInterviewStore'
import { cn } from '@/lib/utils'

interface TrainedPair {
  id: string
  question: string
  answer: string
}

export function TrainingPanel() {
  const context = useInterviewStore((s) => s.context)

  const [question, setQuestion] = useState('')
  const [draftAnswer, setDraftAnswer] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedPairs, setSavedPairs] = useState<TrainedPair[]>([])
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const handleGenerate = useCallback(async () => {
    if (!question.trim()) return
    setDraftAnswer('')
    setIsGenerating(true)
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      await streamCompletion(
        question.trim(),
        context,
        'training',
        (chunk) => setDraftAnswer((prev) => prev + chunk),
        ctrl.signal,
      )
    } catch (err) {
      const error = err as Error
      if (error.name !== 'AbortError') {
        showToast('error', 'Failed to generate suggestion')
      }
    } finally {
      setIsGenerating(false)
    }
  }, [question, context])

  const handleSave = useCallback(async () => {
    if (!question.trim() || !draftAnswer.trim()) return
    setIsSaving(true)
    try {
      const result = await upsertQA(question.trim(), draftAnswer.trim())
      if (result.status === 'blocked_injection') {
        showToast('error', 'Input contains disallowed content')
        return
      }
      setSavedPairs((prev) => [
        { id: `${Date.now()}`, question: question.trim(), answer: draftAnswer.trim() },
        ...prev,
      ])
      setQuestion('')
      setDraftAnswer('')
      const label = result.status === 'updated' ? 'Knowledge updated!' : 'Saved to knowledge base!'
      showToast('success', label)
    } catch (err) {
      showToast('error', (err as Error).message ?? 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [question, draftAnswer])

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
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
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
        {isGenerating ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
        ) : (
          <><Sparkles className="w-4 h-4" /> AI Draft Answer</>
        )}
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
            <label className="block text-sm font-medium text-slate-700">✏️ Edit &amp; Refine Answer</label>
            <textarea
              value={draftAnswer}
              onChange={(e) => setDraftAnswer(e.target.value)}
              rows={6}
              placeholder="AI is generating…"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-sm resize-none outline-none focus:border-indigo-500/60 transition-all shadow-sm font-mono"
            />
            <button
              onClick={handleSave}
              disabled={!draftAnswer.trim() || isSaving}
              className={cn(
                'w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200',
                'bg-emerald-600 text-white hover:bg-emerald-500',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'shadow-md shadow-emerald-600/20',
              )}
            >
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              ) : (
                <><Save className="w-4 h-4" /> Save to Knowledge Base</>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Saved pairs in this session */}
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
                <button
                  onClick={() =>
                    setSavedPairs((prev) => prev.filter((p) => p.id !== pair.id))
                  }
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
        Saved answers are semantically indexed and retrieved during live interviews via Local Hybrid RAG.
      </p>
    </div>
  )
}
