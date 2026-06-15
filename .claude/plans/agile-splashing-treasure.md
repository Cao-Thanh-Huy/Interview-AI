# Interview AI — Implementation Plan

> File này mô tả architecture hiện tại, problem, và kế hoạch implement.
> Mục đích: để LLM khác đọc được, hiểu được, và góp ý chính xác.

---

## Part 1: Current Architecture

### 1.1 Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Desktop shell | Electron ^31.7.7 (Windows target) |
| Frontend UI | React 19 + Vite 6 |
| State | Zustand (UI) + useRef (real-time data) |
| Overlay | BrowserWindow thứ 2 (transparent, always-on-top) |
| Audio capture | Electron `setDisplayMediaRequestHandler` → WASAPI loopback |
| STT | Deepgram Nova-2 (WebSocket streaming) |
| LLM | Groq (nhiều model, fallback chain) |
| Backend | Hono (Node.js) port 3001 |
| Persistence | JSONL filesystem |
| Hot memory | In-memory `HotMemoryManager` |

### 1.2 Process Architecture

```
┌─────────────────────────────────────────────────────┐
│  Electron Main Process (main.js)                     │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │  MainWindow       │  │  OverlayWindow (MiniHub) │ │
│  │  - SetupScreen    │  │  - Audio capture WASAPI  │ │
│  │  - Start/Stop btn │  │  - Deepgram WS           │ │
│  │  - Config/History │  │  - Groq completions      │ │
│  └────────┬─────────┘  │  - Transcript display     │ │
│           │  IPC        └────────┬─────────────────┘ │
│           │                      │                    │
│           ▼                      ▼                    │
│  ┌──────────────────────────────────────────────┐    │
│  │  Backend (Node.js :3001, Hono)               │    │
│  │  /api/deepgram | /api/completion | /api/history│   │
│  │  /api/practice | /api/settings | /api/license  │   │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### 1.3 Data Flow

```
System Audio (interviewer voice from Zoom/Teams)
    │
    ▼
WASAPI Loopback (Electron getDisplayMedia handler)
    │
    ▼
AudioStream
    ├──► MediaRecorder (500ms chunks, WebM/Opus ~8KB)
    │       │
    │       ▼
    │   audioQueue → flushAudioQueue (250ms throttle)
    │       │
    │       ▼
    │   Deepgram WebSocket (speech → text)
    │       │
    │       ▼
    │   ws.onmessage → parse Results / UtteranceEnd
    │       │
    │       ├──► onTranscript(text, isFinal)
    │       │        ├── translateText() → Vietnamese translate
    │       │        └── streamCompletion() → Groq LLM → bullets
    │       └──► onUtteranceEnd(text) → finalize turn
    └──► AudioContext + AnalyserNode (level meter UI)
```

### 1.4 Critical Files

```
frontend/src/
├── overlay/OverlayApp.tsx      # (998 lines) MiniHub UI + session lifecycle
├── overlay/main.tsx             # (66 lines)  Overlay entry + error boundary
├── hooks/useDeepgram.ts        # (507 lines) Audio capture + Deepgram WS ← THE PROBLEM
├── lib/api.ts                  # (176 lines) HTTP client
├── lib/types.ts                # (43 lines)  Shared types
├── components/setup/SetupScreen.tsx
├── store/                      # Zustand stores
└── main.tsx                    # Main window entry

electron/
├── main.js                     # (565 lines) Main process, IPC, WASAPI handler
└── preload.js                  # (73 lines)  Context bridge

backend/src/
├── index.ts                    # Hono server
├── routes/completion.ts        # Groq proxy
├── routes/deepgram.ts          # Deepgram key
├── routes/history.ts           # Session history API
├── lib/hotMemory.ts            # In-memory session state
└── lib/historyStore.ts         # JSONL persistence
```

### 1.5 Session Lifecycle

**START:**
```
Main clicks Start
  → ipcRenderer.send('session:start', {context, sessionId, ...})
    → main.js: overlayWindow.webContents.send('session:init', data)
      → overlay onInit handler
        → setSessionData(data)
          → useEffect([sessionData]): auto-start
            → useDeepgram.start():
                1. connectionIdRef++ (generation counter)
                2. getDisplayMedia({video,audio}) → Electron handler → WASAPI loopback
                3. stop video track, keep audio track
                4. audioStreamRef.current = audioStream
                5. fetchDeepgramKey() → new WebSocket(url, ['token', key])
                6. ws.onopen → new MediaRecorder(audioStream) → recorder.start(500)
                7. ws.onmessage → parse → onTranscript / onUtteranceEnd
```

**STOP:**
```
User clicks ■
  → handleStop()
    → useDeepgram.stop()
        1. connectionIdRef++
        2. recorderRef.current?.stop()
        3. wsRef.current?.close()
        4. audioStreamRef.current?.getTracks().forEach(t => t.stop())  ← WASAPI RELEASED
        5. Clear all queues, reset refs
        6. updateStatus('idle')
    → electronOverlay.stop() (hide overlay)
    → setSessionData(null) → effect cleanup → stop() again (harmless)
    → electronOverlay.stopComplete() (show main window)
```

**BUG: Step 4 kills WASAPI. Step 5-6 clear everything. Next session = new WASAPI = may return silence.**

---

## Part 2: The Bug

### Symptom

```
Session 1:
  11:35:44.790 WebSocket opened ✅
  11:35:45.334 Chunk #1 (7962 bytes)
  ... (~8KB chunks flow)
  11:35:52.130 [Transcript] isFinal ← ✅ ~7s

Session 2:
  11:36:08.069 WebSocket opened ✅
  11:36:08.604 Chunk #1 (8015 bytes)
  ... (same ~8KB chunks)
  11:36:16.075 [WARN] No transcript in 8s ← ❌ 0 transcripts
  → restart → still 0 → restart → user stops
```

### Root Cause

WASAPI loopback trên Windows cần thời gian để release endpoint sau khi `t.stop()` được gọi. Nếu capture mới tạo trước khi endpoint ổn định, track trả về valid object nhưng audio là silence/garbage. Deepgram VAD detect 0 speech → 0 transcripts.

### Secondary: `encoding=opus` param

Dòng 167 `useDeepgram.ts` gửi `encoding=opus` khi audio là WebM container. Deepgram auto-detect WebM thường OK, nhưng param conflict có thể gây lỗi khi reconnect.

### Already Fixed

- Session ID update (`||=` → `=`) ✅
- Level meter reconnect (`sourceNodeRef`) ✅
- `gotTranscript`/`transcriptTimer` closure scope ✅
- Watchdog timer 5s→25s ✅
- `MAX_WATCHDOG_RESTARTS` 3→1 ✅

---

## Part 3: Implementation

### Step 1: Tách `useAudioCapture.ts` (file mới)

Chuyển audio capture + level meter ra khỏi `useDeepgram.ts`.

**What moves:**
- Tiers 1a-4 (getDisplayMedia, fallback chain)
- `audioStreamRef` (giữ sống, không stop giữa sessions)
- AudioContext, AnalyserNode, level timer
- `audioLevel` state, audio source state

**API:**
```typescript
export function useAudioCapture(): {
  stream: MediaStream | null   // persistent across sessions
  source: 'system' | 'microphone' | null
  audioLevel: number
}
```
- Acquire 1 lần khi mount, release khi unmount
- Không public start/stop — luôn chạy
- Không auto-fallback xuống microphone (nguy hiểm cho interview use case — chỉ capture system audio)
- Nếu Tier 1-2-3 đều fail → show diagnostic, ko chuyển sang mic

### Step 2: Viết lại `useDeepgram.ts` (WS + Recorder only)

```typescript
export function useDeepgram({
  stream: MediaStream | null,    // từ useAudioCapture
  onTranscript, onUtteranceEnd, onStatusChange, onError, onWarning
}): {
  start: () => Promise<void>
  stop: () => void
  status: DeepgramStatus
  isMuted: boolean
  toggleMute: () => void
}
```

**start()** — chỉ fetch key + connect WS + tạo MediaRecorder từ stream có sẵn:
```typescript
const start = async () => {
  if (!stream) return
  currentId = ++connectionIdRef.current
  key = await fetchDeepgramKey()
  ws = new WebSocket(url, ['token', key])
  ws.onopen = () => {
    recorder = new MediaRecorder(stream)     // ← shared stream, ko acquire lại
    recorder.ondataavailable = (e) => {
      audioQueueRef.current.push(e.data)
      flushAudioQueue()
    }
    recorder.start(500)
  }
}
```

**stop()** — chỉ close WS + recorder, KHÔNG stop audio stream:
```typescript
const stop = () => {
  connectionIdRef.current++
  recorderRef.current?.stop()
  wsRef.current?.close()
  audioQueueRef.current = []
  isProcessingRef.current = false
  pendingTranscriptRef.current = ''
  updateStatus('idle')
  // KHÔNG stop stream — stream lives in useAudioCapture
  // KHÔNG stop level meter — lives in useAudioCapture
}
```

**Watchdog restart** — chỉ reconnect WS, ko tạo WASAPI mới:
```typescript
transcriptTimer = setTimeout(() => {
  if (gotTranscript || !startRef.current || isStoppedRef.current) return
  if (restartCount >= MAX_RESTARTS) { onError(...); return }
  recorderRef.current?.stop()
  ws.close()
  // stream còn nguyên — chỉ WS mới + recorder mới
  setTimeout(() => startRef.current(), 1000)
}, 25000)
```

### Step 3: Xóa `encoding=opus`

```typescript
// DELETE dòng 167:
...(preferredMime.includes('opus') ? { encoding: 'opus' } : {}),
```

MediaRecorder tạo WebM container. Deepgram auto-detect format. `encoding=opus` gây format mismatch.

### Step 4: Thêm SessionManager (State Machine)

**File mới**: `frontend/src/lib/SessionManager.ts`

```typescript
export type SessionState =
  | 'idle' | 'listening' | 'transcribing'
  | 'thinking' | 'suggesting' | 'stopped' | 'error'

export type SessionEvent =
  | { type: 'INIT'; sessionId: string; context: string }
  | { type: 'TRANSCRIPT'; text: string; isFinal: boolean }
  | { type: 'THINKING' }
  | { type: 'SUGGESTION'; bullets: string[] }
  | { type: 'STOP' }
  | { type: 'ERROR'; message: string }

export class SessionManager {
  private state: SessionState = 'idle'
  private listeners = new Set<(state: SessionState) => void>()
  
  getState() { return this.state }
  onStateChange(cb: (state: SessionState) => void) { ... }
  transition(event: SessionEvent) {
    // log: telemetry.push({ event: event.type, from: this.state, to: nextState })
    this.state = nextState
    this.listeners.forEach(cb => cb(this.state))
  }
}
```

**Lý do làm luôn, ko đợi phase sau:**
- Đang refactor toàn bộ useDeepgram + session lifecycle
- State machine thay thế useEffect chain → dễ maintain hơn ngay từ đầu
- Tách state ra khỏi React → test được, telemetry được
- Không phải refactor lại code sau này

### Step 5: Generation ID (Stale Completion Guard)

```typescript
// OverlayApp.tsx — gần các ref khác
const generationIdRef = useRef(0)

// handleTranscript, isFinal=true:
const genId = ++generationIdRef.current
const myVersion = (turnVersionRef.current[id] ?? 0) + 1
turnVersionRef.current[id] = myVersion
const staleCheck = () =>
  turnVersionRef.current[id] !== myVersion ||
  generationIdRef.current !== genId
```

### Step 6: Update `OverlayApp.tsx`

```typescript
// Thay vì:
const { start, stop, status, audioLevel } = useDeepgram({...})

// Thành:
const { stream, audioLevel } = useAudioCapture()
const { start, stop, status } = useDeepgram({ stream, onTranscript, ... })

// Auto-start:
useEffect(() => {
  if (!sessionData || !stream || mode === 'practice') return
  start()
  return () => stop()
}, [sessionData, stream, mode])

// SessionManager (wiring):
const sessionManager = useRef(new SessionManager())
useEffect(() => {
  if (sessionData) sessionManager.current.transition({ type: 'INIT', ... })
}, [sessionData])
useEffect(() => {
  if (mode === 'practice') return
  status === 'connected' && sessionManager.current.transition({ type: 'LISTENING' })
  status === 'error' && sessionManager.current.transition({ type: 'ERROR', message: '' })
}, [status])
```

**Remove:** `autoStartingRef`, `turnVersionRef` phức tạp
**Keep:** `reconnectAttemptsRef`, reconnect effect, handleTranscript logic

---

## Part 4: What NOT To Do (Yet)

| Item | Lý do |
|------|-------|
| PCM AudioWorklet | Không phải bottleneck hiện tại |
| Local Whisper | Chỉ khi có paying users yêu cầu offline |
| Multi STT provider | Chưa cần thiết |
| SQLite | Có thể làm sau, không block bug fix |
| Telemetry | Có thể làm sau, không block bug fix |
| Auto Update | Có thể làm sau, không block bug fix |

---

## Part 5: Files Changed

| File | Action |
|------|--------|
| `frontend/src/hooks/useAudioCapture.ts` | **NEW** (~80 dòng) |
| `frontend/src/hooks/useDeepgram.ts` | **REWRITE** (507 → ~250 dòng) |
| `frontend/src/lib/SessionManager.ts` | **NEW** (~100 dòng) |
| `frontend/src/overlay/OverlayApp.tsx` | **EDIT** (~30 dòng thay đổi) |

Tổng: ~200 dòng mới + xóa ~250 dòng = **net -50 dòng code** + bug được fix + architecture clean hơn.

---

## Part 6: Verification

1. `tsc --noEmit` — 0 errors
2. Start session → transcript trong <10s ✅
3. Stop → Start lại ×5 → transcript vẫn về ✅
4. Log: `getDisplayMedia` chỉ 1 lần duy nhất ✅
5. Level meter luôn hoạt động ✅
6. Watchdog restart chỉ restart WS, ko reset audio ✅
7. Mute/unmute vẫn hoạt động ✅
