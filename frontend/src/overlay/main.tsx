import ReactDOM from 'react-dom/client'
import { OverlayApp } from './OverlayApp'
import './overlay.css'

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
    // IPC direct file write (Electron) — most reliable, no network needed
    if (eAudio?.logToFile) {
      eAudio.logToFile(entry)
    } else {
      // Browser fallback: HTTP
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
  <OverlayApp />,
)
