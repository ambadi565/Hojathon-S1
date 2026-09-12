# Connect Frontend to Python RLM Backend

## Problem

The current React frontend (Vite + React + Tailwind) is entirely **hardcoded** — it simulates a "Standard vs Turbo RLM" benchmark race with preset logs and fake timers. It never actually calls the Python RLM inference engine. The goal is to wire the frontend to the real RLM backend so that:

1. User enters a **query** (+ optional file/text) in the frontend
2. The frontend sends it to a Python **FastAPI** backend
3. The backend runs the RLM engine (`RLMRunner.run(prompt_text)`)  — the root model reduces/decomposes the prompt, the worker model handles sub-queries
4. **Real-time streaming** of trajectory steps (iterations, code executed, REPL output, sub-calls) back to the frontend via **Server-Sent Events (SSE)**
5. The final answer is displayed in the frontend

## Proposed Changes

### Python Backend — FastAPI Server

#### [NEW] [`server.py`](file:///home/user/Hojathon/Hojathon-S1/src/server.py)

A FastAPI application that:
- Exposes `POST /api/query` — accepts `{ "query": "...", "context": "..." }` and returns an SSE stream
- Runs `RLMRunner` in a background thread, yielding trajectory events as JSON SSE messages:
  - `event: iteration` — `{ iteration, assistant_text, code_executed, repl_output, sub_call_count }`
  - `event: final` — `{ answer, total_sub_calls, terminated }`
  - `event: error` — `{ message }`
- Adds CORS middleware so the Vite dev server (port 5173) can reach it
- Runs on port `8000`

#### [MODIFY] [`requirements.txt`](file:///home/user/Hojathon/Hojathon-S1/src/requirements.txt)

Add `fastapi`, `uvicorn[standard]`, and `sse-starlette`.

---

### React Frontend

#### [MODIFY] [`App.jsx`](file:///home/user/Hojathon/Hojathon-S1/src/frontend/src/App.jsx)

**Complete rewrite** of the frontend to become a **real RLM query interface** instead of a benchmark simulator:

- **Query input area** — text input for the query + a large textarea (or file upload) for the context/document
- **Submit** sends a `POST` to `http://localhost:8000/api/query` and reads the SSE stream
- **Live trajectory panel** — shows each RLM iteration as it arrives (iteration number, code the root model wrote, REPL stdout/traceback, sub-call count)
- **Final answer panel** — displays the final answer when the stream completes
- **Loading states** — spinner while waiting, streaming animation during iterations
- **Error handling** — displays errors gracefully

The design will retain the premium dark theme aesthetic (zinc/emerald palette, monospace terminals) but repurpose it for real inference output.

#### [MODIFY] [`vite.config.js`](file:///home/user/Hojathon/Hojathon-S1/src/frontend/vite.config.js)

Add a proxy configuration so `/api/*` requests are forwarded to `localhost:8000`, avoiding CORS issues in development.

---

## Architecture Flow

```
┌──────────────────────┐     POST /api/query (SSE)     ┌──────────────────────┐
│   React Frontend     │ ────────────────────────────►  │   FastAPI Backend    │
│   (Vite, port 5173)  │                                │   (Uvicorn, :8000)   │
│                      │  ◄─── event: iteration ──────  │                      │
│  Query Input         │  ◄─── event: iteration ──────  │  RLMRunner.run()     │
│  Context Textarea    │  ◄─── event: final ──────────  │   ├─ Root Model      │
│  Trajectory Viewer   │                                │   ├─ REPL            │
│  Final Answer        │                                │   └─ Worker Model    │
└──────────────────────┘                                └──────────────────────┘
                                                              │        ▲
                                                              ▼        │
                                                        ┌─────────────────┐
                                                        │  Gemini API     │
                                                        │  (gemini-3.6-   │
                                                        │   flash)        │
                                                        └─────────────────┘
```

## Open Questions

> [!IMPORTANT]
> **Context input method**: Should users paste text directly into a textarea, upload a file, or both? I'll implement **both** (textarea + file upload) for maximum flexibility.

> [!NOTE]
> **API key handling**: The existing `.env` already has `GEMINI_API_KEY`. The backend will read it from there — no API key input in the frontend.

## Verification Plan

### Manual Verification
1. Start the FastAPI backend: `python -m uvicorn server:app --reload` from `src/`
2. Start the Vite frontend: `npm run dev` from `src/frontend/`
3. Enter a query, paste context text, and verify:
   - SSE stream delivers real-time trajectory steps
   - Each iteration appears live in the trajectory panel
   - Final answer renders correctly
   - Error cases (empty query, API failures) are handled
