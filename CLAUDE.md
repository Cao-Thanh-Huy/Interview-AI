# CLAUDE.md – Project Overview and Guidelines

## 1. Project Summary

**Custom Interview AI** is a real‑time interview assistant built with a React + Vite front‑end running inside an Electron overlay (MiniHub) and a Node/Express back‑end providing API endpoints for:
- Deepgram speech‑to‑text & text‑to‑speech
- Claude AI completions (live suggestions, translation, mock‑scoring, knowledge‑base retrieval)
- Knowledge‑base management (upsert Q&A, alias suggestions, history)

The overlay shows live questions, translations, and bullet‑point answers while allowing the user to resize, theme, and configure font settings.

## 2. Architecture Overview

```
┌───────────────────────┐          ┌───────────────────────┐
│  Electron (main.js)    │  IPC →   │  Overlay React App    │
│  - creates overlay win │          │  - OverlayApp.tsx      │
│  - communicates via IPC│          │  - MiniHub UI (CSS)    │
└─────────────▲─────────┘          └─────────────▲─────────┘
              │                                 │
              │                               IPC│
              │                                 │
   (Renderer Process)                (Renderer Process)
              │                                 │
              ▼                                 ▼
   ┌───────────────────────┐   HTTP   ┌───────────────────────┐
   │   Frontend SPA (Vite) │◀──────▶│   Backend (Express)   │
   │   - src/*.tsx          │        │   - /api/deepgram      │
   │   - store (zustand)    │        │   - /api/completion    │
   │   - lib/api.ts (fetch) │        │   - /api/knowledge/... │
   └───────────────────────┘        └───────────────────────┘
```

- **OverlayApp.tsx** handles lifecycle, resizing, translation, and UI state, communicating with Electron via `window.electronOverlay`.
- **InterviewScreenLayout.tsx** renders the main interview view, delegating question rendering to `TurnCard`/`QuestionBlock`.
- **Overlay CSS** (`frontend/src/overlay/overlay.css`) defines the MiniHub styling. Recent changes replaced `white-space: nowrap` with `pre‑wrap` and made overflow visible so full questions and translations are displayed.
- **Backend** implements the Claude and Deepgram integrations and a simple knowledge‑base store.

## 3. Front‑end Core Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **OverlayApp** | `frontend/src/overlay/OverlayApp.tsx` | MiniHub UI, resizing, theme, font, translation, streaming bullets |
| **InterviewScreenLayout** | `frontend/src/components/interview/InterviewScreenLayout.tsx` | Main interview screen, status bar, turn feed |
| **TurnCard** (inner) | same file | Renders a single turn (question, translation, bullets) |
| **QuestionBlock** | `frontend/src/components/interview/QuestionBlock.tsx` | Displays a single question line and optional translation |
| **StatusDot** | `frontend/src/components/interview/StatusDot.tsx` | Live/idle status indicator |
| **API Layer** | `frontend/src/lib/api.ts` | Wrapper around fetch for backend endpoints (streamCompletion, translateText, etc.) |
| **Zustand Store** | `frontend/src/store/*.ts` | Global state (`useInterviewStore`, `useUiMode`) |

## 4. Back‑end Core Endpoints

- `GET /api/deepgram` – returns Deepgram API key (used by front‑end to initialise SDK).
- `POST /api/deepgram` – proxy for audio STT.
- `POST /api/completion` – generic Claude request (live, translate, mock‑scoring, etc.).
- `POST /api/completion/translate` – translate text using Claude.
- `POST /api/knowledge/qa` – upsert question/answer into KB.
- `POST /api/knowledge/suggest‑aliases` – generate alias suggestions.
- `GET /api/knowledge/history` – list saved sessions.
- `GET /api/knowledge/history/:sessionId` – fetch a specific session.

## 5. Development Workflow

1. **Install dependencies**
   ```bash
   npm install   # root workspace installs both front‑end and back‑end
   ```
2. **Set environment variables** (Windows PowerShell example)
   ```powershell
   $env:DEEPGRAM_API_KEY = "your‑key"
   $env:CLAUDE_API_KEY   = "your‑key"
   ```
3. **Run locally**
   - Terminal 1: `npm run dev:backend` (Express on http://localhost:3001)
   - Terminal 2: `npm run dev:frontend` (Vite dev server)
   - Terminal 3: `npm run electron` (opens Electron window connected to the dev back‑end)
4. **Production build**
   ```bash
   npm run build:frontend   # Vite production bundle
   npm run build:electron   # package Electron (nsis/dmg)
   ```

## 6. MiniHub Configuration (localStorage keys)
| Key | Type | Description | Default |
|-----|------|-------------|---------|
| `hub-font` | number (10‑18) | Font size (px) | `13` |
| `hub-width` | number (260‑720) | Overlay width (px) | `440` |
| `hub-height` | number (120‑550) | Overlay height (px) | `340` |
| `hub-opacity` | number (0.2‑1) | Background opacity | `0.93` |
| `hub-theme` | `'dark'`/`'light'` | Theme selection | `'dark'` |
| `hub-hist` | number (3,5,8,10) | Number of past turns kept | `8` |

These values persist across sessions and are applied on component mount.

## 7. Common Shortcuts
- **Ctrl + Scroll** on MiniHub – change font size quickly.
- **Ctrl + Shift + H** – toggle *stealth mode* (hide overlay, leave only status dot).
- **A− / A+** – decrease / increase font size (top‑bar buttons).
- **◑− / ◑+** – make overlay more transparent / more opaque.
- **☀ / ☾** – toggle light / dark theme.
- **■** – stop the current interview session.
- **Gear icon** – open MiniHub Preferences (font, width, history count).

## 8. Known Issues & TODOs
- Persist `turns` across app restarts (currently in‑memory only).
- Improve streaming buffer handling for Unicode edge cases.
- Add optional auto‑translate toggle for questions and bullets.
- Write unit tests for Zustand stores and critical UI components.
- Detect system theme (`prefers-color-scheme`) to set default MiniHub theme.
- Implement “pin” feature to keep a specific turn visible.
- Better error UI (toasts) for API failures (e.g., translation quota exceeded).

## 9. Contributing Guide
1. Fork the repository and create a feature branch (`git checkout -b feat/your-feature`).
2. Follow the **development workflow** above.
3. Run `npm run lint` before committing.
4. Add tests for any new logic.
5. Open a Pull Request targeting `main` with a clear description of changes.
6. CI will run lint, type‑check, and build; ensure all passes before merging.

## 10. Useful References
- Claude API Docs: https://docs.anthropic.com/claude
- Deepgram Docs: https://deepgram.com/docs
- Electron IPC: https://www.electronjs.org/docs/latest/api/ipc-main
- Zustand Store: https://github.com/pmndrs/zustand
- Vite + Electron Boilerplate: https://github.com/caoxiemeihao/electron-vite-react

---
**End of CLAUDE.md**