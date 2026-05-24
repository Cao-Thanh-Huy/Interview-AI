# InterviewAI — AI-Powered Interview Assistant

Real-time interview assistant that listens to the interviewer's questions via microphone, searches your uploaded CV, and suggests concise English answers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| AI (answers) | Groq — `llama-3.1-8b-instant` |
| Voice transcription | Deepgram |
| CV search | In-memory store (no external DB needed) |
| UI | React + Tailwind CSS + shadcn/ui |

---

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env` and fill in:

```env
DEEPGRAM_API_KEY=your_deepgram_key
GROQ_API_KEY=your_groq_key
```

- **Deepgram** — free tier at [deepgram.com](https://deepgram.com), used for voice-to-text
- **Groq** — free tier at [console.groq.com](https://console.groq.com), used for AI answers

### 3. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## How to Use During an Interview

### Step 1 — Upload your CV
1. Open the app → click **PDF Manager**
2. Upload your CV as a PDF
3. The app stores it in memory — re-upload if you restart the server

### Step 2 — Set interview context (optional)
In the **background** field, enter the job title or context, e.g.:
> "Senior React Developer at Shopee"

### Step 3 — Start listening
1. Click **Start Recording**
2. Speak or let the interviewer speak — Deepgram transcribes in real time
3. When a question is detected, the AI automatically:
   - Searches your CV for relevant experience
   - Suggests 3–4 concise bullet points you can say in response

### Step 4 — Use the suggestions
The suggestions appear in the **Copilot** panel. They're short enough to glance at while speaking.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/completion` | Get AI answer suggestion |
| `POST` | `/api/pdf` | Upload CV PDF |
| `DELETE`| `/api/pdf?filename=` | Remove uploaded CV |
| `GET`  | `/api/pdf` | List uploaded documents |
| `GET`  | `/api/deepgram` | Get Deepgram token for browser |

### `/api/completion` request body

```json
{
  "prompt": "Tell me about yourself",
  "flag": "copilot",
  "bg": "Senior React Developer position"
}
```

`flag` options: `"copilot"` (answer suggestion) | `"summerizer"` (summarize conversation)

---

## Notes

- CV data is stored **in memory** — lost on server restart, re-upload to restore
- All answers are in **English** (designed for English-language interviews)
- Groq free tier: 30 req/min, sufficient for interview use
