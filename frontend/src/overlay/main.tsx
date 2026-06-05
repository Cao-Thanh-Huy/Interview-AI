import React, { Component, type ReactNode } from 'react'
import ReactDOM from 'react-dom/client'
import { OverlayApp } from './OverlayApp'
import './overlay.css'

// ─── Error Boundary ──────────────────────────────────────────────────────────
class OverlayErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error, info: any) {
    console.error('[Overlay] React error boundary caught:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 20, color: '#ef4444', fontFamily: 'monospace', fontSize: 12,
          background: '#0c0c14', height: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 24 }}>⚠️</span>
          <strong>Overlay Error</strong>
          <span style={{ color: '#94a3b8', textAlign: 'center', maxWidth: 300 }}>
            {this.state.error.message}
          </span>
        </div>
      )
    }
    return this.props.children
  }
}

// ─── Debug reporter: IPC file log + HTTP fallback ────────────────────────────
;(function installOverlayDebug() {
  const eAudio = (window as unknown as { electronAudio?: { logToFile?: (msg: string) => void } }).electronAudio

  const send = (level: string, ...args: unknown[]) => {
    const msg = '[OVERLAY] ' + args.map(a => {
      if (a instanceof Error) return a.stack ?? a.message
      if (typeof a === 'object') { try { return JSON.stringify(a) } catch { return String(a) } }
      return String(a)
    }).join(' ')
    const entry = `[${level.toUpperCase()}] ${msg}`
    if (eAudio?.logToFile) {
      eAudio.logToFile(entry)
    } else {
      fetch('http://localhost:3001/api/debug/log', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, msg }),
      }).catch(() => {})
    }
  }

  const origError = console.error.bind(console)
  const origWarn  = console.warn.bind(console)
  const origLog   = console.log.bind(console)
  console.error = (...a) => { origError(...a); send('error', ...a) }
  console.warn  = (...a) => { origWarn(...a);  send('warn',  ...a) }
  console.log   = (...a) => { origLog(...a);   send('info',  ...a) }
  window.onerror = (msg, src, line, col, err) => {
    send('error', `UNCAUGHT: ${msg} at ${src}:${line}:${col}`, err)
    return false
  }
  window.onunhandledrejection = (e) => { send('error', `UNHANDLED PROMISE: ${e.reason}`) }
  send('info', '=== Overlay renderer started ===')
})()

ReactDOM.createRoot(document.getElementById('overlay-root')!).render(
  <OverlayErrorBoundary>
    <OverlayApp />
  </OverlayErrorBoundary>,
)
