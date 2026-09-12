# Walkthrough: Frontend ↔ Backend Integration

## Summary

Connected the React frontend to the Python RLM inference engine via a **FastAPI backend with SSE streaming**. The frontend was rewritten from a hardcoded benchmark simulator into a real query interface that streams live trajectory steps.

---

## Changes Made

### 1. [NEW] [`server.py`](file:///home/user/Hojathon/Hojathon-S1/src/server.py) — FastAPI Backend

- **`POST /api/query`** — accepts `query` + optional `context` text or file upload via `multipart/form-data`
- **`StreamingRLMRunner`** — subclass of `RLMRunner` that pushes trajectory events to a `queue.Queue` as each iteration completes
- **SSE stream** — yields 3 event types:
  - `event: started` — context metadata (char count, preview, max iterations)
  - `event: iteration` — per-iteration data (code executed, REPL output, sub-call count)
  - `event: final` — final answer + stats
  - `event: error` — graceful error reporting
- **`GET /api/health`** — health check endpoint
- Runs the RLM loop in a **background thread** so the SSE stream isn't blocked
- CORS middleware configured for cross-origin access

### 2. [MODIFIED] [`requirements.txt`](file:///home/user/Hojathon/Hojathon-S1/src/requirements.txt)

Added: `fastapi`, `uvicorn[standard]`, `python-multipart`

### 3. [MODIFIED] [`vite.config.js`](file:///home/user/Hojathon/Hojathon-S1/src/frontend/vite.config.js)

Added proxy rule: `/api` → `http://localhost:8000` — so the Vite dev server forwards API calls to the Python backend

### 4. [REWRITTEN] [`App.jsx`](file:///home/user/Hojathon/Hojathon-S1/src/frontend/src/App.jsx)

Complete rewrite from hardcoded benchmark simulator to real RLM interface:
- **Query input** — text field with Send button
- **Context area** — textarea for pasting text + file upload button
- **Live trajectory panel** — expandable cards for each iteration showing:
  - Root model response text
  - Executed Python code (blue highlight)
  - REPL stdout/stderr (green/red)
  - Sub-call count badges
- **Final answer panel** — displays the answer when the stream completes
- **Stats panel** — elapsed time, iteration count, sub-calls, termination status
- **"How it works"** explainer card
- **Error handling** — cancel button, error display, graceful stream termination
- Premium dark theme (zinc/emerald palette, monospace terminals)

---

## Verification Results

| Check | Status |
|-------|--------|
| Backend health (`GET /api/health`) | ✅ `{"status":"ok","engine":"RLM Harness"}` |
| Frontend loads (HTTP 200 at `:5173`) | ✅ |
| Proxy works (`:5173/api/health` → `:8000`) | ✅ |
| SSE streaming works (`POST /api/query`) | ✅ Events stream correctly |
| Gemini API calls | ⚠️ 403 — current API key needs refresh |

> [!NOTE]
> The SSE pipeline works end-to-end. The 403 error from Gemini is an **API key issue** (the key in `.env` has been denied access). Update the `GEMINI_API_KEY` in [`src/.env`](file:///home/user/Hojathon/Hojathon-S1/src/.env) with a valid key to run real queries.

## How to Run

```bash
# Terminal 1: Start the backend
cd src/
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000

# Terminal 2: Start the frontend  
cd src/frontend/
# Use Node 20+
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20
npm run dev
```

Open `http://localhost:5173` in your browser.
