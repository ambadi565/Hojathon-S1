# Hojathon

Build agents that don't just respond — they act.

Hojathon is an agentic AI hackathon. Teams build systems that can reason, plan, call tools or APIs, and carry out multi-step tasks on their own — not just chatbots that answer a single prompt. This repository is the official starter and submission template: fork it, build your project inside your fork, and submit your final work back here through a Pull Request.

There's no required stack. Build your agent with any language, any framework, any model provider or orchestration approach — LangChain, a custom agent loop, raw API calls, whatever gets the job done. This repo itself contains no code. It's just the structure and docs every team needs so judges can actually run and evaluate what you built.

---

## Getting Started

1. **Fork this repository** — click "Fork" at the top of this page, then click the green **"Create fork"** button on the page that follows to confirm.
2. **Clone your fork** to your computer:
   ```bash
   git clone https://github.com/<your-username>/<your-fork>.git
   ```
3. **Read through this README and the [`docs/`](docs/) folder in full** before you write any code, so you understand the rules, the workflow, and what your final submission needs to include.
4. **Add your teammates as collaborators** on your fork (GitHub → Settings → Collaborators) so everyone can push directly.
5. **Build your project** inside your fork, using whatever stack fits your idea.
6. **Commit and push regularly** — don't wait until the deadline to save your work.
7. **Fill in the project documentation** (see [Project Documentation](#project-documentation) below and the [`docs/`](docs/) folder).
8. **Open your final Pull Request** back to this repository before the deadline.

---

## Team Information

Fill this in as soon as your team is formed.

**Team ID:**

**Team Name: RTX4060**

**Team Members:**

1. Abhijith Ambadi
2. Sarang S
3. Ahmed Farook

**Project Name:Recurse**


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

## Participant Rules

* Teams must contain **1–3 members**.
* Teams may use **any technology stack**.
* Teams should commit their work regularly.
* Do **not** commit passwords, API keys, tokens, or other secrets.
* The final state of the repository at the submission deadline will be considered for judging.
* The final Pull Request must be submitted before the official deadline.
* Participants are responsible for ensuring their project can be evaluated.

---

## GitHub Workflow

```
Official Hojathon Repository
        ↓
      Fork
        ↓
   Team's Fork
        ↓
  Build Project
        ↓
  Commit & Push
        ↓
 Complete README
        ↓
   Final PR
        ↓
   Organizers
        ↓
    Judges
```

Don't open a Pull Request for every change. Work normally inside your own fork, committing and pushing as often as you like — only open a Pull Request to the official repository when you're ready to make your **final submission**.

---

## Final Pull Request

When your project is ready, open a Pull Request from your fork's default branch into the official Hojathon repository.

**PR title format:**

```
[TEAM-ID] Project Name
```

**Example:**

```
[TEAM-042] Smart Campus Assistant
```

**The PR description must contain:**

* Team ID
* Team name
* Team members
* Project name
* Problem statement
* Solution
* Technology stack
* Demo URL
* Demo video
* Special instructions for judges

See [`docs/SUBMISSION.md`](docs/SUBMISSION.md) for the full submission checklist and process, and use the [Pull Request template](.github/PULL_REQUEST_TEMPLATE.md) when you open your final PR.
