import { useEffect, useState } from 'react'
import { Square, EyeOff, Mic, MicOff, Monitor, AlertTriangle, PictureInPicture } from 'lucide-react'
import { useInterviewStore } from '@/store/useInterviewStore'
import { cn } from '@/lib/utils'
import type { DeepgramStatus, AudioSource } from '@/lib/types'

interface TopBarProps {
  status: DeepgramStatus
  audioSource: AudioSource
  startTime: number
  onStop: () => void
  errorMessage?: string | null
  warningMessage?: string | null
  onDismissWarning?: () => void
  isMuted: boolean
  onToggleMute: () => void
  isMiniPlayerOpen: boolean
  onToggleMiniPlayer: () => void
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

export function TopBar({
  status,
  audioSource,
  startTime,
  onStop,
  errorMessage,
  warningMessage,
  onDismissWarning,
  isMuted,
  onToggleMute,
  isMiniPlayerOpen,
  onToggleMiniPlayer,
}: TopBarProps) {
  const { toggleStealth } = useInterviewStore()
  const elapsed = useElapsed(startTime)

  return (
    <div className="shrink-0 flex items-center justify-between px-4 h-11 bg-white/60 backdrop-blur-md border-b border-slate-200/50 relative z-20">
      {/* Left: status indicator + timer */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-full border border-slate-200/30">
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              status === 'connected' && 'bg-red-500 animate-pulse',
              status === 'connecting' && 'bg-amber-500 animate-pulse',
              status === 'error' && 'bg-red-600',
              status === 'idle' && 'bg-slate-300',
            )}
          />
          <span className="text-xs font-mono text-slate-600 font-medium">
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
          <span className="flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 border border-slate-200/30 px-2.5 py-1 rounded-full font-medium">
            {audioSource === 'system' ? (
              <Monitor className="w-3 h-3 text-slate-400" />
            ) : (
              <Mic className="w-3 h-3 text-slate-400" />
            )}
            {audioSource === 'system' ? 'System Audio' : 'Microphone'}
          </span>
        )}

        {errorMessage && (
          <span className="flex items-center gap-1 text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200/40 px-2.5 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3 shrink-0 text-amber-500" />
            <span className="truncate max-w-[280px]">{errorMessage}</span>
          </span>
        )}

        {warningMessage && (
          <span className="flex items-center gap-1.5 text-xs text-orange-600 font-medium bg-orange-50 border border-orange-200/40 px-2.5 py-1 rounded-full max-w-[360px]">
            <AlertTriangle className="w-3 h-3 shrink-0 text-orange-500" />
            <span className="truncate">{warningMessage}</span>
            {onDismissWarning && (
              <button onClick={onDismissWarning} className="ml-1 text-orange-400 hover:text-orange-600">✕</button>
            )}
          </span>
        )}
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleMute}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
            isMuted
              ? 'text-red-600 bg-red-50 border border-red-200 hover:bg-red-100/80'
              : 'text-slate-500 border border-slate-200 hover:text-slate-800 hover:bg-slate-50',
          )}
          title={isMuted ? 'Unmute — resume transcription' : 'Mute — pause transcription (when you speak)'}
        >
          {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {isMuted ? 'Muted' : 'Mute'}
        </button>

        <button
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
            isMiniPlayerOpen
              ? 'text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100/80'
              : 'text-slate-500 border border-slate-200 hover:text-slate-800 hover:bg-slate-50',
          )}
          title="Toggle Always-on-top Mini HUD"
        >
          <PictureInPicture className="w-3.5 h-3.5" />
          {isMiniPlayerOpen ? 'Mini On' : 'Mini Player'}
        </button>

        <button
          onClick={toggleStealth}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 border border-slate-200 hover:text-slate-800 hover:bg-slate-50 transition-colors"
          title="Stealth Mode (Ctrl+Shift+H)"
        >
          <EyeOff className="w-3.5 h-3.5" />
          Hide
        </button>

        <button
          onClick={onStop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 transition-colors"
        >
          <Square className="w-3 h-3 fill-current" />
          Stop
        </button>
      </div>
    </div>
  )
}
