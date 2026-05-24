import { useEffect, useState } from 'react'
import { Square, EyeOff, Mic, Monitor, AlertTriangle } from 'lucide-react'
import { useInterviewStore } from '@/store/useInterviewStore'
import { cn } from '@/lib/utils'
import type { DeepgramStatus, AudioSource } from '@/lib/types'

interface TopBarProps {
  status: DeepgramStatus
  audioSource: AudioSource
  startTime: number
  onStop: () => void
  errorMessage?: string | null
}

function useElapsed(startTime: number) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(id)
  }, [startTime])
  return elapsed
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function TopBar({ status, audioSource, startTime, onStop, errorMessage }: TopBarProps) {
  const { toggleStealth } = useInterviewStore()
  const elapsed = useElapsed(startTime)

  return (
    <div className="shrink-0 flex items-center justify-between px-4 h-11 bg-black/70 backdrop-blur-xl border-b border-white/5 relative z-20">
      {/* Left: status indicator + timer */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              status === 'connected' && 'bg-red-500 animate-pulse',
              status === 'connecting' && 'bg-yellow-500 animate-pulse',
              status === 'error' && 'bg-red-700',
              status === 'idle' && 'bg-white/20',
            )}
          />
          <span className="text-xs font-mono text-white/60">
            {status === 'connected'
              ? formatTime(elapsed)
              : status === 'connecting'
                ? 'Connecting…'
                : status === 'error'
                  ? 'Error'
                  : 'Idle'}
          </span>
        </div>

        {audioSource && (
          <span className="flex items-center gap-1 text-xs text-white/35 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full">
            {audioSource === 'system' ? (
              <Monitor className="w-3 h-3" />
            ) : (
              <Mic className="w-3 h-3" />
            )}
            {audioSource === 'system' ? 'System Audio' : 'Microphone'}
          </span>
        )}

        {errorMessage && (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="truncate max-w-[280px]">{errorMessage}</span>
          </span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleStealth}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-white/35 hover:text-white/65 hover:bg-white/5 transition-colors"
          title="Stealth Mode (Ctrl+Shift+H)"
        >
          <EyeOff className="w-3.5 h-3.5" />
          Hide
        </button>

        <button
          onClick={onStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors"
        >
          <Square className="w-3 h-3 fill-current" />
          Stop
        </button>
      </div>
    </div>
  )
}
