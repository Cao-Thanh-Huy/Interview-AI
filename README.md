# 🎙️ Interview Copilot — Live AI-Powered Interview Assistant

A professional, ultra-low latency, real-time interview assistant that listens to your live conversations via microphone, searches your pre-trained SQLite Knowledge Base (containing your CV, projects, and target Q&As) using Local Hybrid RAG (FTS5 + Vector Search), and streams direct, spoken-style suggestions in sub-seconds.

---

## ⚡ Key Highlights
- **Streamlined Setup (Single-Click Launch)**: Zero tedious CV uploads or background text forms. Click a single button to warm up and launch the live copilot instantly using pre-trained data.
- **Local Hybrid Search (FTS5 + Local Vector RAG)**: Features an offline hybrid retrieval engine inside SQLite:
  - **FTS5 (Full-Text Search)**: Rapid exact keyword match (takes $< 5\text{ms}$).
  - **ONNX Semantic Search**: Local vector similarity using `@xenova/transformers` (takes $10-15\text{ms}$ running fully offline).
- **Background Warm-up Sequence**: Automatically pre-warms the SQLite page cache, compiles ONNX execution threads, and pre-establishes TCP/TLS keep-alive connection handshakes to Groq. Slashes "Cold Start" latency of the first query down to **~180ms**.
- **Interactive Backup & Restore CLI**: One-command PowerShell utility to safely backup, manage, and interactively restore your trained databases.
- **Git-Ready Database Sync**: Smart `.gitignore` tracking allows you to push your trained `memory.db` to GitHub while keeping dynamic logs (`history/`) and transient lock files (`-wal`/`-shm`) strictly ignored.

---

## 🛠️ Modern Tech Stack

| Layer | Technology | Role |
|-------|------------|------|
| **Frontend** | React 19 + Vite + Tailwind CSS + Framer Motion | High-fidelity, smooth desktop UI with glassmorphism |
| **Backend** | Hono (Node Server) + TypeScript | Lightweight, ultra-fast routing engine |
| **AI Generation** | Groq (`llama-3.1-8b-instant`) | Ultra-fast streaming completions (under 300ms) |
| **Voice Transcription** | Deepgram | Real-time voice-to-text websocket streaming |
| **Local Database** | SQLite (`better-sqlite3`) | Persistent local knowledge and vector store |
| **Local Embeddings** | ONNX Runtime (`Xenova/all-MiniLM-L6-v2`) | Offline 384-dimensional vector extraction |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **Windows PowerShell** (for running automation scripts)

### 2. Configure Environment Variables
Copy `.env.example` to `.env` in the root directory and fill in your keys:
```env
DEEPGRAM_API_KEY=your_deepgram_api_key
GROQ_API_KEY=your_groq_api_key
```
- Get a free Deepgram key at [deepgram.com](https://deepgram.com) (used for voice transcription).
- Get a free Groq key at [console.groq.com](https://console.groq.com) (used for instant AI answers).

### 3. Run with Self-Healing Scripts (Windows PowerShell)

Our startup script automatically detects package managers, verifies node environments, manages ports, and launches the stack:

* **Start the Stack (Backend + Frontend in background)**:
  ```powershell
  .\start.ps1
  ```
  *Opens browser automatically at `http://localhost:5173`.*
  
* **Stop the Stack (Clean process tree shutdown)**:
  ```powershell
  .\stop.ps1
  ```

---

## 📂 Database Utilities (Backup & Restore CLI)

Keep your pre-trained tri thức databases safe before major modifications or training sessions using our dedicated utility:

* **Quick Safe Backup**:
  ```powershell
  .\backup.ps1
  ```
  - Creates a timestamped duplicate at `backend/data/backups/memory_YYYYMMDD_HHMMSS.db`.
  - Creates a fast restore shortcut at `backend/data/memory.db.bak`.
  - Safely detects active database locking states (`-wal` files).

* **Interactive Restore Menu**:
  ```powershell
  .\backup.ps1 -Restore
  ```
  - Lists all available timestamped backups (ordered newest first) along with dates and file sizes.
  - Asks you to select a backup number and safely confirm the overwrite.

---

## 🎙️ Operating Workflow

### Step 1: Pre-Interview Training
1. Open the app and navigate to the **Pre-Interview Training** tab.
2. Enter questions and their model answers (e.g., CV project experiences, STAR-method stories, technical knowledge) and click **Train Knowledge**.
3. SQLite immediately runs a local ONNX pipeline to extract vector embeddings, indexes the text in FTS5, and saves it permanently to `memory.db`.

### Step 2: Instant Launch
1. Under the **Setup Session** tab, verify the status badge says `● AI COPILOT READY`.
2. Click **Launch Interview Session**. The assistant starts listening immediately via your default microphone.

### Step 3: Speak & Get Live Suggestions
1. As the interviewer asks questions, Deepgram transcribes the audio in real-time.
2. The AI Copilot queries the local SQLite DB, merges relevant pre-trained RAG contexts, and streams **3-4 senior engineer-style spoken bullet points** (under 120 words total) to your stealth panel.

### Step 4: Stealth Mode
- Press `Ctrl+Shift+H` during an active interview to hide/show the Copilot UI instantly (showing only a tiny floating dot).

---

## 🛡️ Git Collaboration & Repository Hygiene

To keep your Git history clean while sharing your trained AI database across machines, `.gitignore` is pre-configured with **selective ignore rules**:

- **Tracked** (`memory.db`): Commits and pushes your pre-trained SQLite database directly to GitHub.
- **Ignored**:
  - `backend/data/memory.db-shm` and `backend/data/memory.db-wal` (prevents process locking conflicts and binary corruption).
  - `backend/data/backups/` and `backend/data/memory.db.bak` (keeps local backups strictly on your machine).
  - `backend/data/history/` (safeguards private interview recordings and transcripts).

To save and sync your curated database to GitHub, simply run:
```bash
git add .gitignore backup.ps1 backend/data/memory.db
git commit -m "feat: sync clean pre-trained interview database"
git push origin main
```
