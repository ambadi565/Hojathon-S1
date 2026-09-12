# Hojathon

## Team Information

**Team Name: RTX4060**

**Team Members:**

1. Abhijith Ambadi
2. Sarang S
3. Ahmed Farook

**Project Name:** RLM Inference Engine


---

## Project Documentation

### Project Name

RLM Inference Engine


### Team

RTX4060

### Problem Statement

This project addresses the need for an AI system that can work over large documents or context windows, reason about the content, and take action when the answer requires analysis beyond a simple single-pass response. A static script or plain UI is not enough because the system must be able to inspect long inputs, decide what to investigate, generate and execute Python code in a persistent REPL, and use sub-queries to refine the answer.

### Proposed Solution

The project implements an agentic Recursive Language Model (RLM) harness that combines a Python backend, a FastAPI streaming API, and a React frontend. The backend runs an orchestration loop where the root model reads the user query and context, emits Python code for the REPL when needed, executes that code, and feeds the observations back into the model. Worker-model sub-calls help the system break down complex analysis tasks while the frontend streams live iteration details back to the user in real time.

This project is an implementation of the Recursive Language Models research paper, ["Recursive Language Models"](https://arxiv.org/abs/2512.24601).

### Key Features

* Query a large document or paste context directly in the UI
* Upload a file for analysis through the web interface
* Run the RLM loop with live streaming of iterations, code, REPL output, and sub-call counts
* Use a persistent Python REPL so state can be carried across steps
* Expose a health endpoint and a streaming `/api/query` endpoint for integration
* Support Gemini-based model orchestration through the Google GenAI SDK

### Technology Stack

| Category | Technology |
| -------- | ---------- |
| Frontend | React, Vite, JavaScript |
| Backend | Python, FastAPI, Uvicorn |
| Database | None |
| AI/ML | Recursive Language Model harness, Gemini models via Google GenAI |
| APIs | Google Gemini API |
| Other | Pydantic, python-dotenv, pytest |

### How It Works

1. The React frontend sends a query and optional context/file to the FastAPI backend at `/api/query`.
2. The backend builds a prompt from the document/context and starts a `StreamingRLMRunner` in a background thread.
3. The root model analyzes the prompt and may return Python code blocks for execution in a persistent REPL.
4. The REPL captures stdout, errors, and variable state, then sends the results back into the next root-model turn as observations.
5. The runner continues until it reaches a `FINAL(...)` or `FINAL_VAR(...)` answer, or until the iteration limit is reached.
6. The frontend receives Server-Sent Events (`started`, `iteration`, `final`, `error`) and displays the live trajectory plus the final answer.

### Setup & Installation

1. Install Python dependencies from `src/requirements.txt`:
   ```bash
   cd src
   python3 -m pip install -r requirements.txt
   ```
2. Install frontend dependencies:
   ```bash
   cd src/frontend
   npm install
   ```
3. Create a `src/.env` file based on `src/.env.example` and add a valid `GEMINI_API_KEY`.
4. Make sure the Google Gemini project behind the API key has access enabled. If the key is denied by Google, generate a new valid key and update `.env`.

### Running the Project

Start the backend in one terminal:
```bash
cd src
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000
```

Start the frontend in another terminal:
```bash
cd src/frontend
npm run dev
```

Then open:
```text
http://localhost:5173
```

Use the UI to paste context or upload a file, enter a query, and view the streaming RLM trajectory and final answer.

---