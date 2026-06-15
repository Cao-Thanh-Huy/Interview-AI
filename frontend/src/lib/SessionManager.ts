/**
 * SessionManager — state machine cho interview session lifecycle.
 *
 * States:
 *   idle → listening → transcribing → thinking → suggesting → listening ...
 *   any → stopped | error
 *
 * Dùng useRef để giữ instance xuyên suốt component lifecycle.
 * Không phụ thuộc React → dễ test, dễ thêm telemetry.
 */

export type SessionState =
  | 'idle'
  | 'listening'     // Deepgram connected, VAD chờ speech
  | 'transcribing'  // Đang nhận transcript interim/final
  | 'thinking'      // Groq đang generate suggestion
  | 'suggesting'    // Bullets đang stream về
  | 'stopped'
  | 'error'

export type SessionEvent =
  | { type: 'INIT' }
  | { type: 'LISTENING' }
  | { type: 'TRANSCRIPT'; text: string; isFinal: boolean }
  | { type: 'THINKING' }
  | { type: 'SUGGESTING' }
  | { type: 'STOP' }
  | { type: 'ERROR'; message: string }

type TransitionMap = Partial<Record<SessionState, Partial<Record<SessionEvent['type'], SessionState>>>>

const TRANSITIONS: TransitionMap = {
  idle:         { INIT: 'listening' },
  listening:    { TRANSCRIPT: 'transcribing', ERROR: 'error', STOP: 'stopped' },
  transcribing: { THINKING: 'thinking', TRANSCRIPT: 'transcribing', ERROR: 'error', STOP: 'stopped' },
  thinking:     { SUGGESTING: 'suggesting', ERROR: 'error', STOP: 'stopped' },
  suggesting:   { TRANSCRIPT: 'transcribing', THINKING: 'thinking', ERROR: 'error', STOP: 'stopped' },
  stopped:      { INIT: 'listening' },
  error:        { INIT: 'listening' },
}

export class SessionManager {
  private state: SessionState = 'idle'
  private listeners = new Set<(state: SessionState) => void>()
  private eventLog: Array<{ from: SessionState; to: SessionState; event: string; ts: number }> = []

  getState(): SessionState {
    return this.state
  }

  onStateChange(cb: (state: SessionState) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  transition(event: SessionEvent): SessionState {
    const from = this.state
    const allowed = TRANSITIONS[from]
    const next = allowed?.[event.type] as SessionState | undefined

    if (!next) {
      // Invalid transition — log và giữ nguyên state
      console.warn(`[SessionManager] Invalid transition: ${from} → ${event.type}`)
      return from
    }

    this.state = next
    this.eventLog.push({ from, to: next, event: event.type, ts: Date.now() })
    this.listeners.forEach(cb => cb(next))

    if (from !== next) {
      console.log(`[Session] ${from} → ${next} (${event.type})`)
    }

    return next
  }

  /**
   * Reset về idle (dùng khi component unmount hoặc cần reset hoàn toàn)
   */
  reset(): void {
    this.state = 'idle'
    this.eventLog = []
  }

  /**
   * Telemetry: lấy event log gần đây
   */
  getRecentEvents(count = 10): Array<{ from: SessionState; to: SessionState; event: string; ts: number }> {
    return this.eventLog.slice(-count)
  }
}
