import { createRoot } from 'react-dom/client'
import { Component, type ReactNode, type ErrorInfo } from 'react'
import './index.css'
import App from './App'

// ─── Debug reporter: forward console → backend /api/debug/log ────────────────
// Activated in dev mode so tool can read renderer output via backend log file
;(function installDebugReporter() {
  const BASE = (import.meta.env.VITE_API_BASE ?? '') + '/api/debug/log'
  const send = (level: string, ...args: unknown[]) => {
    const msg = args.map(a => {
      if (a instanceof Error) return a.stack ?? a.message
      if (typeof a === 'object') { try { return JSON.stringify(a) } catch { return String(a) } }
      return String(a)
    }).join(' ')
    fetch(BASE, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, msg }) }).catch(() => {})
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
  window.onunhandledrejection = (e) => {
    send('error', `UNHANDLED PROMISE: ${e.reason}`)
  }
  send('info', '=== Renderer started ===')
})()


// ─── ErrorBoundary: catches runtime crashes, shows readable error ─────────────
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.error) {
      const err = this.state.error as Error
      return (
        <div style={{
          height: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          background: '#0c0c14', color: '#f43f5e',
          padding: 32, fontFamily: 'monospace', gap: 16
        }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>⚠ Runtime Error</div>
          <div style={{ fontSize: 13, color: '#f1f5f9', maxWidth: 600, wordBreak: 'break-all' }}>
            {err.message}
          </div>
          <pre style={{
            fontSize: 11, color: '#94a3b8', background: '#161620',
            padding: 16, borderRadius: 8, maxWidth: 700, overflow: 'auto',
            maxHeight: 300, width: '100%'
          }}>
            {err.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: '8px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
