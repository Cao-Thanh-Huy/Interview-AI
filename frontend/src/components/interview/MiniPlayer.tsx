import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles, Mic, MicOff, Monitor, Square, X, Move, SendHorizontal, Maximize2, Minimize2, Languages, Loader2 } from 'lucide-react'
import { useInterviewStore } from '@/store/useInterviewStore'
import { translateText } from '@/lib/api'

// Ultra-lightweight markdown-free parser for suggestions
function renderCleanSuggestions(text: string, isGenerating?: boolean) {
  if (!text) {
    if (isGenerating) {
      return (
        <div className="space-y-2 py-1.5 animate-pulse">
          <div className="h-2 bg-slate-200/60 rounded w-11/12" />
          <div className="h-2 bg-slate-200/60 rounded w-10/12" />
          <div className="h-2 bg-slate-200/60 rounded w-9/12" />
          <div className="h-2 bg-slate-200/60 rounded w-7/12" />
        </div>
      )
    }
    return null
  }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  return (
    <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600">
      {lines.map((line, idx) => {
        const cleanLine = line.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '')
        const parts = cleanLine.split(/(\*\*.*?\*\*)/)
        return (
          <li key={idx} className="leading-relaxed">
            {parts.map((part, pIdx) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={pIdx} className="font-semibold text-slate-800">
                    {part.slice(2, -2)}
                  </strong>
                )
              }
              return part
            })}
          </li>
        )
      })}
    </ul>
  )
}

interface MiniPlayerProps {
  onClose: () => void
  onStop: () => void
  onManualSubmit: (text: string) => void
  isRecording: boolean
  audioSource: 'system' | 'microphone' | null
  isMuted: boolean
  onToggleMute: () => void
}

export function MiniPlayer({ onClose, onStop, onManualSubmit, isRecording, audioSource, isMuted, onToggleMute }: MiniPlayerProps) {
  const turns = useInterviewStore((s) => s.turns)
  const currentInterimCaption = useInterviewStore((s) => s.currentInterimCaption)

  const [translatedTurnIds, setTranslatedTurnIds] = useState<Record<string, boolean>>({})
  const [translatingIds, setTranslatingIds] = useState<Record<string, boolean>>({})

  const handleToggleTranslate = useCallback(async (id: string, text: string) => {
    const turn = turns.find((t) => t.id === id)
    if (!turn) return

    if (translatedTurnIds[id]) {
      setTranslatedTurnIds((prev) => ({ ...prev, [id]: false }))
      return
    }

    if (turn.answerTranslation) {
      setTranslatedTurnIds((prev) => ({ ...prev, [id]: true }))
      return
    }

    try {
      setTranslatingIds((prev) => ({ ...prev, [id]: true }))
      const result = await translateText(text)
      useInterviewStore.getState().updateTurnAnswerTranslation(id, result)
      setTranslatedTurnIds((prev) => ({ ...prev, [id]: true }))
    } catch (err) {
      console.error('Failed to translate suggestions:', err)
    } finally {
      setTranslatingIds((prev) => ({ ...prev, [id]: false }))
    }
  }, [turns, translatedTurnIds])

  // Only render the last 8 valid turns (Memoized Derived State - Ring Buffer)
  const recentTurns = useMemo(() => {
    return turns
      .filter((t) => t.question && t.question.trim().length >= 2)
      .slice(-8)
  }, [turns])

  // PiP Window state
  const [pipWindow, setPipWindow] = useState<Window | null>(null)
  const pipWindowRef = useRef<Window | null>(null)  // ref to avoid stale closure in cleanup
  const [isFallbackActive, setIsFallbackActive] = useState(false)

  // Draggable state for fallback
  const fallbackRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const positionRef = useRef({ x: 20, y: 80 }) // Bottom-right anchor fallback
  const dragStartRef = useRef({ x: 0, y: 0 })

  // Trigger Native PiP or Fallback
  useEffect(() => {
    async function setupPiP() {
      if (typeof window !== 'undefined' && 'documentPictureInPicture' in window) {
        try {
          // Open PiP window
          const pipW = await (window as any).documentPictureInPicture.requestWindow({
            width: 360,
            height: 480,
          })

          // Safe Style Syncing: Clone stylesheet links and inline style tags
          const styles = document.querySelectorAll('style, link[rel="stylesheet"]')
          styles.forEach((el) => {
            pipW.document.head.appendChild(el.cloneNode(true))
          })

          // Setup base layout styles
          pipW.document.title = 'Copilot Mini HUD'
          // Fix height chain: html + body must both have 100% height for inner h-full to work
          const baseStyle = pipW.document.createElement('style')
          baseStyle.textContent = 'html,body{height:100%;margin:0;box-sizing:border-box;}'
          pipW.document.head.appendChild(baseStyle)
          pipW.document.body.className = 'bg-[#f6f8fb] text-[#0f172a] p-3 overflow-hidden font-sans'

          // Handle clean window closure (Memory leak protection)
          pipW.addEventListener('pagehide', () => {
            setPipWindow(null)
            onClose()
          })

          pipWindowRef.current = pipW
          setPipWindow(pipW)
        } catch (err) {
          console.warn('PiP window request failed, using draggable fallback:', err)
          setIsFallbackActive(true)
        }
      } else {
        // Fallback for Safari / Firefox
        setIsFallbackActive(true)
      }
    }

    setupPiP()

    return () => {
      // Use ref (not state) to avoid stale closure — state value is always null here
      if (pipWindowRef.current) {
        try { pipWindowRef.current.close() } catch {}
        pipWindowRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [manualInput, setManualInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleSize = useCallback(() => {
    const next = !isExpanded
    setIsExpanded(next)
    // PiP window: use resizeTo API
    if (pipWindowRef.current) {
      try {
        pipWindowRef.current.resizeTo(next ? 520 : 360, next ? 640 : 480)
      } catch {}
    }
    // Fallback panel: change inline style
    if (fallbackRef.current) {
      fallbackRef.current.style.width = next ? '480px' : '320px'
      fallbackRef.current.style.height = next ? '560px' : '384px'
    }
  }, [isExpanded])

  const handleManualSubmit = useCallback(() => {
    const text = manualInput.trim()
    if (!text) return
    setManualInput('')
    onManualSubmit(text)
  }, [manualInput, onManualSubmit])

  // Auto-scroll logic
  const scrollRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)

  // Detect if user scrolled up (disable auto-scroll) or back to bottom (re-enable)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el
      autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 60
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [pipWindow, isFallbackActive]) // re-attach when container mounts

  // Scroll to bottom on new turns or live caption (only if auto-scroll enabled)
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [recentTurns, currentInterimCaption])

  // Drag Handlers for Fallback Panel (GPU Accelerated via translate3d + rAF)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDraggingRef.current = true
    dragStartRef.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    }
    e.preventDefault()
  }, [])

  useEffect(() => {
    if (!isFallbackActive) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !fallbackRef.current) return

      window.requestAnimationFrame(() => {
        const x = e.clientX - dragStartRef.current.x
        const y = e.clientY - dragStartRef.current.y
        positionRef.current = { x, y }
        if (fallbackRef.current) {
          fallbackRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
        }
      })
    }

    const handleMouseUp = () => {
      isDraggingRef.current = false
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isFallbackActive])

  // Mini HUD Content View
  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200/50 pb-2 mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              isRecording ? 'bg-red-500 animate-pulse' : 'bg-slate-300'
            }`}
          />
          <h1 className="text-xs font-semibold text-slate-800">Copilot Mini</h1>
          {audioSource && (
            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full flex items-center gap-1">
              {audioSource === 'system' ? (
                <Monitor className="w-2.5 h-2.5 text-slate-500" />
              ) : (
                <Mic className="w-2.5 h-2.5 text-slate-500" />
              )}
              {audioSource === 'system' ? 'System' : 'Mic'}
            </span>
          )}
        </div>
        <button
          onClick={onToggleMute}
          className={`p-1 rounded-md transition-colors ${
            isMuted
              ? 'text-red-500 bg-red-50 hover:bg-red-100'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
          title={isMuted ? 'Unmute — resume transcription' : 'Mute — pause while you speak'}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={toggleSize}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title={isExpanded ? 'Shrink window' : 'Expand window'}
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={onStop}
          className="p-1 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Stop interview and return to setup"
        >
          <Square className="w-3.5 h-3.5 fill-current" />
        </button>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          title="Show main window"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Mini Scrollable turns feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-1 space-y-3 min-h-0">
        {recentTurns.length === 0 && !currentInterimCaption ? (
          <div className="h-full flex items-center justify-center text-center py-8">
            <p className="text-[10px] text-slate-400 leading-normal">
              Speak to see real-time suggestions here.
            </p>
          </div>
        ) : (
          recentTurns.map((turn) => (
            <div key={turn.id} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
              <p className="text-[11px] text-slate-500 font-medium mb-1 line-clamp-2">
                🎤 {turn.question}
              </p>
              {turn.questionTranslation && (
                <p className="text-[10px] text-slate-400 italic mb-1 pl-4 flex items-center gap-1">
                  <span>🇻🇳</span>
                  <span>{turn.questionTranslation}</span>
                </p>
              )}
              {(turn.answer || turn.isGenerating) && (
                <div className="bg-white/40 border border-slate-200/30 rounded-lg p-2 h-[150px] overflow-y-auto flex flex-col justify-start transition-all duration-300">
                  <div className="flex items-center gap-1 mb-1">
                    <Sparkles className={`w-3 h-3 ${turn.isGenerating ? 'text-indigo-500 animate-pulse' : 'text-indigo-600'}`} />
                    <span className="text-[9px] text-indigo-600 font-semibold tracking-wider uppercase flex items-center gap-1">
                      {turn.isGenerating ? '⚡ Live Hint' : '✨ AI Suggestions'}
                    </span>
                    {turn.isGenerating ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse ml-auto" />
                    ) : (
                      <button
                        onClick={() => handleToggleTranslate(turn.id, turn.answer)}
                        disabled={translatingIds[turn.id]}
                        className={`ml-auto p-1 py-0.5 rounded transition-colors flex items-center gap-1 text-[9px] font-medium leading-none ${
                          translatedTurnIds[turn.id]
                            ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        }`}
                        title={translatedTurnIds[turn.id] ? "Show English" : "Dịch sang tiếng Việt"}
                      >
                        {translatingIds[turn.id] ? (
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-500" />
                        ) : (
                          <Languages className="w-2.5 h-2.5" />
                        )}
                        <span>{translatedTurnIds[turn.id] ? 'Gốc' : 'Dịch'}</span>
                      </button>
                    )}
                  </div>
                  {renderCleanSuggestions(
                    translatedTurnIds[turn.id] && turn.answerTranslation
                      ? turn.answerTranslation
                      : turn.answer,
                    turn.isGenerating
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Manual question input */}
      <div className="shrink-0 pt-2 mt-1 border-t border-slate-200/50">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleManualSubmit() } }}
            placeholder="Type a question..."
            className="flex-1 text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 placeholder-slate-400 focus:outline-none focus:border-indigo-300 focus:bg-white transition-colors"
          />
          <button
            onClick={handleManualSubmit}
            disabled={!manualInput.trim()}
            className="p-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
            title="Submit question (Enter)"
          >
            <SendHorizontal className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )

  // Render native Document Picture-in-Picture
  if (pipWindow) {
    return createPortal(content, pipWindow.document.body)
  }

  // Render Fallback Draggable in-page panel
  if (isFallbackActive) {
    return (
      <div
        ref={fallbackRef}
        className="fixed z-50 bg-white/95 border border-slate-200 shadow-2xl rounded-2xl p-3 flex flex-col pointer-events-auto transition-shadow overflow-auto"
        style={{
          bottom: '20px',
          right: '20px',
          width: '320px',
          height: '384px',
          minWidth: '240px',
          minHeight: '220px',
          maxHeight: '90vh',
          resize: 'both',
          transform: `translate3d(0, 0, 0)`,
          willChange: 'transform',
        }}
      >
        {/* Drag handle for fallback */}
        <div
          onMouseDown={handleMouseDown}
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-800 text-white rounded-full px-2.5 py-0.5 text-[9px] flex items-center gap-1 cursor-grab active:cursor-grabbing hover:bg-slate-700 transition-colors shadow"
        >
          <Move className="w-2.5 h-2.5" />
          <span>Drag Mini HUD</span>
        </div>
        {content}
      </div>
    )
  }

  return null
}
