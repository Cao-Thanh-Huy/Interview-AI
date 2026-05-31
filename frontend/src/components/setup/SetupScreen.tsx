import React, { useEffect, useState } from 'react'
import { Mic } from 'lucide-react'
import { useInterviewStore } from '@/store/useInterviewStore'
import { Sidebar, type SidebarTab } from '@/components/layout/Sidebar'
import { TrainingPanel } from './TrainingPanel'
import { HistoryReviewPanel } from './HistoryReviewPanel'
import { MockInterviewPanel } from './MockInterviewPanel'
import { SettingsModal } from '@/components/activation/SettingsModal'
import { apiUrl } from '@/lib/api'

// ─── Mic Orb — visual anchor ──────────────────────────────────────────────────
function MicOrb() {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer ambient bloom */}
      <div style={{
        position: 'absolute',
        width: 310, height: 310,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
        pointerEvents: 'none',
        animation: 'micGlow 3.5s ease-in-out infinite',
      }} />
      {/* Outer pulse ring */}
      <div style={{
        position: 'absolute',
        width: 192, height: 192,
        borderRadius: '50%',
        border: '1.5px solid rgba(99,102,241,0.22)',
        pointerEvents: 'none',
        animation: 'micPulse 3.5s ease-in-out infinite',
      }} />
      {/* Inner ring + icon */}
      <div style={{
        width: 152, height: 152,
        borderRadius: '50%',
        background: 'var(--surface)',
        border: '1.5px solid rgba(99,102,241,0.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative', zIndex: 1,
        boxShadow: '0 0 40px rgba(99,102,241,0.12)',
      }}>
        <Mic
          size={48}
          color="#ffffff"
          strokeWidth={1.5}
          style={{ animation: 'micIconBreathe 3.5s ease-in-out infinite' } as React.CSSProperties}
        />
      </div>
    </div>
  )
}

// ─── Setup Tab ────────────────────────────────────────────────────────────────
function SetupTab({ onStart, isStarting }: { onStart: () => void; isStarting: boolean }) {
  const [apiOk, setApiOk] = useState<boolean | null>(null)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const audioDeviceId = useInterviewStore((s) => s.audioDeviceId)
  const setAudioDeviceId = useInterviewStore((s) => s.setAudioDeviceId)

  // Load API key status
  useEffect(() => {
    fetch(apiUrl('/settings/api-keys'))
      .then(r => r.json())
      .then(d => setApiOk(Boolean(d.groqKeySet && d.deepgramKeySet)))
      .catch(() => setApiOk(false))
  }, [])

  // Enumerate audio input devices — MUST stop the temp stream after to avoid keeping mic open
  useEffect(() => {
    let tempStream: MediaStream | null = null
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        tempStream = stream
        return navigator.mediaDevices.enumerateDevices()
      })
      .then(devices => {
        // Stop the temp stream immediately after enumeration
        tempStream?.getTracks().forEach(t => t.stop())
        const inputs = devices.filter(d => d.kind === 'audioinput')
        setAudioDevices(inputs)
        // Auto-select loopback device if found and nothing selected yet
        if (!audioDeviceId) {
          const loopback = inputs.find(d =>
            /stereo mix|what u hear|cable output|vb-audio|blackhole|loopback/i.test(d.label)
          )
          if (loopback) setAudioDeviceId(loopback.deviceId)
        }
      })
      .catch(() => {
        tempStream?.getTracks().forEach(t => t.stop())
      })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isElectron = !!(window as unknown as { electronAudio?: unknown }).electronAudio

  const subtitle =
    apiOk === false
      ? 'Configure API keys in Settings to continue'
      : isElectron
        ? 'Ready · will auto-capture system audio'
        : !audioDeviceId
          ? 'Select an audio device below to continue'
          : 'Ready · session will capture selected device only'

  // In Electron: WASAPI loopback handles audio automatically — no device required
  // In browser: require explicit device selection (no loopback available otherwise)
  const canStart = isStarting === false && apiOk !== false && (isElectron || !!audioDeviceId)

  const isLoopback = (label: string) =>
    /stereo mix|what u hear|cable output|vb-audio|blackhole|loopback/i.test(label)

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: '0 24px',
    }}>

      {/* Mic orb */}
      <MicOrb />

      {/* Heading */}
      <h1 style={{
        margin: '32px 0 10px',
        fontSize: 26, fontWeight: 600,
        color: 'var(--text)',
        letterSpacing: '-0.02em',
        textAlign: 'center',
        lineHeight: 1.2,
      }}>
        Ready to record
      </h1>

      {/* Subtitle */}
      <p style={{
        margin: '0 0 24px',
        fontSize: 14, color: 'var(--text)',
        opacity: 0.65,
        textAlign: 'center',
      }}>
        {subtitle}
      </p>

      {/* Audio device picker */}
      {audioDevices.length > 0 && (
        <div style={{ width: '100%', maxWidth: 360, marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em', marginBottom: 6, textTransform: 'uppercase' }}>
            Audio Source
          </label>
          <select
            value={audioDeviceId ?? ''}
            onChange={e => setAudioDeviceId(e.target.value || null)}
            style={{
              width: '100%',
              padding: '8px 10px',
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 6,
              color: 'var(--text)',
              fontSize: 12,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="">Default microphone</option>
            {audioDevices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {isLoopback(d.label) ? '⭐ ' : ''}{d.label || `Device ${d.deviceId.slice(0, 8)}`}
              </option>
            ))}
          </select>
          {audioDeviceId && audioDevices.find(d => d.deviceId === audioDeviceId && isLoopback(d.label)) && (
            <p style={{ margin: '6px 0 0', fontSize: 10, color: '#5b8a6b' }}>
              ✓ Loopback device — will capture interviewer audio
            </p>
          )}
          {!audioDevices.some(d => isLoopback(d.label)) && (
            <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>
              Tip: Install{' '}
              <button
                onClick={() => window.open('https://vb-audio.com/Cable/', '_blank')}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: 'var(--primary)', fontWeight: 600, fontSize: 10,
                  cursor: 'pointer', textDecoration: 'underline',
                  textDecorationColor: 'rgba(99,102,241,0.4)',
                }}
              >
                VB-Cable
              </button>
              {' '}to capture Zoom/Teams audio
            </p>
          )}
        </div>
      )}

      {/* Primary CTA */}
      <button
        onClick={onStart}
        disabled={!canStart}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '12px 44px',
          background: canStart ? '#5254cc' : '#1e2035',
          color: canStart ? '#fff' : '#3a4560',
          fontSize: 14, fontWeight: 600,
          letterSpacing: '0.01em',
          border: 'none',
          borderRadius: 8,
          cursor: canStart ? 'pointer' : 'not-allowed',
          boxShadow: canStart
            ? '0 6px 28px rgba(82,84,204,0.50), 0 1px 0 rgba(255,255,255,0.08) inset'
            : 'none',
          transition: 'box-shadow 150ms ease-out, background 150ms ease-out',
        }}
      >
        {isStarting ? 'Starting…' : 'Start Session →'}
      </button>

      {/* Hint */}
      <span style={{
        position: 'absolute', bottom: 20,
        fontSize: 11, color: 'var(--muted)',
        letterSpacing: '0.04em',
        userSelect: 'none',
      }}>
        Ctrl+K · command palette
      </span>
    </div>
  )
}

// ─── Tab labels ───────────────────────────────────────────────────────────────
const TAB_LABELS: Record<SidebarTab, string> = {
  setup:    'SESSION',
  training: 'TRAINING',
  history:  'HISTORY',
  mock:     'MOCK INTERVIEW',
}

// ─── SetupScreen ──────────────────────────────────────────────────────────────
export function SetupScreen() {
  const setPhase    = useInterviewStore((s) => s.setPhase)
  const initSession = useInterviewStore((s) => s.initSession)

  const [isStarting,   setIsStarting]   = useState(false)
  const [activeTab,    setActiveTab]    = useState<SidebarTab>('setup')
  const [showSettings, setShowSettings] = useState(false)

  const handleStart = () => {
    setIsStarting(true)
    initSession()

    const electronSession = (window as unknown as { electronSession?: { start: (d: unknown) => void } }).electronSession
    if (electronSession) {
      // Electron: 2-window mode — overlay takes over, main window hides
      const { context, sessionId } = useInterviewStore.getState()
      const hubWidth = Number(localStorage.getItem('hub-width'))
      electronSession.start({
        context,
        sessionId,
        hubWidth: (hubWidth >= 260 && hubWidth <= 720) ? hubWidth : 440,
      })
      setIsStarting(false)  // overlay handles everything from here
    } else {
      // Browser fallback: single-window mode
      setTimeout(() => setPhase('interview'), 200)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>

      {/* Sidebar */}
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} onSettings={() => setShowSettings(true)} />

      {/* Main */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>

        {/* Top bar — label + status only, NO action button */}
        <header className="app-header drag-region">
          <span style={{
            fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em', color: 'var(--muted)',
            textTransform: 'uppercase',
          }}>
            {TAB_LABELS[activeTab]}
          </span>

          {activeTab === 'setup' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
              <span style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>Ready</span>
            </div>
          )}
        </header>

        {/* Content */}
        <div
          className="animate-panel contain"
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          {activeTab === 'setup'    && <SetupTab onStart={handleStart} isStarting={isStarting} />}
          {activeTab === 'training' && <TrainingPanel />}
          {activeTab === 'history'  && <HistoryReviewPanel />}
          {activeTab === 'mock'     && <MockInterviewPanel />}
        </div>
      </div>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onLicenseDeactivated={() => window.location.reload()}
        />
      )}
    </div>
  )
}
