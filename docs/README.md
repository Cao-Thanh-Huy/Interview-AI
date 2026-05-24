# Interview Copilot

Real-time AI interview assistant — captures interviewer audio, transcribes in real-time with Deepgram, and generates instant answer suggestions via Groq LLM.

## Project Structure

```
interview-ai/
├── backend/          # Node.js + Hono API server (port 3001)
└── frontend/         # Vite + React 19 app (port 5173)
```

## Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)
- Deepgram API key → https://console.deepgram.com
- Groq API key → https://console.groq.com

## Quick Start

### 1. Configure environment

```bash
# backend
cp backend/.env.example backend/.env
# Fill in GROQ_API_KEY and DEEPGRAM_API_KEY
```

### 2. Install & run backend

```bash
cd backend
pnpm install
pnpm dev          # starts on http://localhost:3001
```

### 3. Install & run frontend

```bash
cd frontend
pnpm install
pnpm dev          # starts on http://localhost:5173
```

### 4. Open browser

Navigate to `http://localhost:5173`

---

## How It Works

```
Screen Share (getDisplayMedia)
    │
    ▼ audio track (interviewer voice)
MediaRecorder (500ms chunks)
    │
    ▼ binary chunks over WebSocket
Deepgram Nova-2 (real-time STT)
    │
    ▼ on UtteranceEnd event
POST /api/completion (Hono backend)
    │  ├── search CV chunks (RAG)
    │  └── build prompt → Groq LLM
    ▼ streaming text
AI Suggestions Panel (Vite frontend)
```

## UI Flow

1. **Setup Screen** — enter interview context, upload CV/Resume PDF (optional)
2. **Start Session** — browser prompts for screen share; audio is captured
3. **Interview Screen** — two panels:
   - **Left**: Live captions (real-time transcript)
   - **Right**: AI Suggestions (auto-generated on utterance end)
4. **Stop** — return to setup screen

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+H` | Toggle stealth mode (hides entire UI) |

## Tech Stack

| Layer | Tech | Version |
|---|---|---|
| Backend framework | Hono | ^4.6.19 |
| Backend runtime | Node.js | 20.x LTS |
| LLM | Groq (llama-3.1-8b-instant) | ^0.26.0 |
| STT | Deepgram Nova-2 | ^3.9.0 |
| PDF parsing | pdf-parse | ^1.1.1 |
| Frontend build | Vite | ^6.3.5 |
| UI library | React | ^19.1.0 |
| Styling | Tailwind CSS | ^3.4.17 |
| State | Zustand | ^5.0.3 |
| Animation | Framer Motion | ^11.18.2 |
