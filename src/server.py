"""FastAPI server for the RLM harness.

Exposes a streaming SSE endpoint that runs the RLM inference engine and
streams trajectory steps (iterations, code, REPL output) back to the
frontend in real time.
"""

from __future__ import annotations

import json
import sys
import threading
import queue
import traceback
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# Ensure the src directory is on the path so we can import rlm
sys.path.insert(0, str(Path(__file__).resolve().parent))

from rlm.agent import RLMRunner, TrajectoryStep, RunResult  # noqa: E402
from rlm.config import Settings  # noqa: E402

app = FastAPI(title="RLM Inference Server", version="1.0.0")

# CORS — allow the Vite dev server and any local origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Patched RLMRunner that emits trajectory events to a queue
# ---------------------------------------------------------------------------

class StreamingRLMRunner(RLMRunner):
    """RLMRunner subclass that pushes trajectory steps to a queue as they happen."""

    def __init__(self, event_queue: queue.Queue, **kwargs):
        super().__init__(**kwargs)
        self._event_queue = event_queue

    def run(self, prompt_text: str) -> RunResult:
        """Override run to emit SSE events for each iteration."""
        from rlm.agent import (
            _parse_final,
            _parse_final_var,
            _extract_code_blocks,
            TrajectoryStep,
            RunResult,
        )
        from rlm.prompts import build_system_prompt

        # --- Step 1: Initialise REPL ---
        sub_call_counter = {"count": 0}

        def _tracked_worker(prompt: str) -> str:
            sub_call_counter["count"] += 1
            return self.client.call_worker(prompt)

        self.repl.inject_llm_query(_tracked_worker)
        self.repl.set_context(prompt_text)

        # --- Step 2: Build initial message history ---
        total_chars = len(prompt_text)
        preview = prompt_text[: self.settings.PREVIEW_LIMIT]
        system_prompt = build_system_prompt(total_chars, preview, self.settings.PREVIEW_LIMIT)

        history: list[dict] = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"The context has been loaded ({total_chars:,} characters, "
                    f"type: text). Please begin analysing it to answer the "
                    f"user's query."
                ),
            },
        ]

        trajectory: list[TrajectoryStep] = []
        total_sub_calls = 0

        # Emit a "started" event
        self._event_queue.put({
            "event": "started",
            "data": {
                "total_chars": total_chars,
                "preview": preview[:200],
                "max_iterations": self.settings.MAX_ITERATIONS,
            },
        })

        # --- Step 3: Main loop ---
        for iteration in range(1, self.settings.MAX_ITERATIONS + 1):
            # 3.1 — Call root model
            sub_call_counter["count"] = 0
            assistant_text = self.client.call_root(history)
            history.append({"role": "assistant", "content": assistant_text})

            step = TrajectoryStep(iteration=iteration, assistant_text=assistant_text)

            # 3.2 — Check for termination tags
            final_text = _parse_final(assistant_text)
            if final_text is not None:
                step.sub_call_count = sub_call_counter["count"]
                total_sub_calls += step.sub_call_count
                trajectory.append(step)

                # Emit final iteration + final answer
                self._emit_step(step)
                self._event_queue.put({
                    "event": "final",
                    "data": {
                        "answer": final_text,
                        "total_sub_calls": total_sub_calls,
                        "terminated": True,
                        "iterations_used": iteration,
                    },
                })
                return RunResult(
                    answer=final_text,
                    trajectory=trajectory,
                    total_sub_calls=total_sub_calls,
                    terminated=True,
                )

            final_var = _parse_final_var(assistant_text)
            if final_var is not None:
                value = self.repl.env_globals.get(final_var, f"<variable '{final_var}' not found>")
                step.sub_call_count = sub_call_counter["count"]
                total_sub_calls += step.sub_call_count
                trajectory.append(step)

                self._emit_step(step)
                self._event_queue.put({
                    "event": "final",
                    "data": {
                        "answer": str(value),
                        "total_sub_calls": total_sub_calls,
                        "terminated": True,
                        "iterations_used": iteration,
                    },
                })
                return RunResult(
                    answer=str(value),
                    trajectory=trajectory,
                    total_sub_calls=total_sub_calls,
                    terminated=True,
                )

            # 3.3 — Extract code blocks
            code = _extract_code_blocks(assistant_text)

            if code:
                # 3.4 — Execute in REPL
                output, success, exc = self.repl.execute(code)
                step.code_executed = code
                step.repl_output = output
                step.sub_call_count = sub_call_counter["count"]
                total_sub_calls += step.sub_call_count
                trajectory.append(step)

                # Emit iteration event
                self._emit_step(step)

                # 3.5 — Append observation
                status = "✅ Execution succeeded" if success else "❌ Execution failed"
                observation = f"[REPL observation — {status}]\n{output}"
                history.append({"role": "user", "content": observation})
            else:
                # 3.6 — No code and no termination: nudge the model
                step.sub_call_count = sub_call_counter["count"]
                total_sub_calls += step.sub_call_count
                trajectory.append(step)

                self._emit_step(step)

                nudge = (
                    "Your last response contained neither executable code nor a "
                    "termination tag. Please either:\n"
                    "1. Write Python code inside a ```repl block to continue analysis, or\n"
                    "2. Provide your final answer using FINAL(your answer) or FINAL_VAR(variable_name)."
                )
                history.append({"role": "user", "content": nudge})

        # --- Step 4: MAX_ITERATIONS reached ---
        answer = "[RLM loop reached MAX_ITERATIONS without a final answer]"
        self._event_queue.put({
            "event": "final",
            "data": {
                "answer": answer,
                "total_sub_calls": total_sub_calls,
                "terminated": False,
                "iterations_used": self.settings.MAX_ITERATIONS,
            },
        })
        return RunResult(
            answer=answer,
            trajectory=trajectory,
            total_sub_calls=total_sub_calls,
            terminated=False,
        )

    def _emit_step(self, step: TrajectoryStep) -> None:
        """Push a trajectory step event to the queue."""
        self._event_queue.put({
            "event": "iteration",
            "data": {
                "iteration": step.iteration,
                "assistant_text": step.assistant_text[:2000],  # Cap for transport
                "code_executed": step.code_executed,
                "repl_output": step.repl_output,
                "sub_call_count": step.sub_call_count,
            },
        })


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "engine": "RLM Harness"}


@app.post("/api/query")
async def run_query(
    query: str = Form(...),
    context: str = Form(default=""),
    file: UploadFile | None = File(default=None),
):
    """Run an RLM query and stream trajectory steps via SSE.

    Accepts either inline context text or a file upload (file takes precedence).
    Returns a Server-Sent Events stream with iteration and final events.
    """
    # Build the prompt text
    context_text = context
    if file is not None:
        raw = await file.read()
        try:
            context_text = raw.decode("utf-8")
        except UnicodeDecodeError:
            context_text = raw.decode("latin-1")

    if context_text:
        prompt_text = f"DOCUMENT:\n{context_text}\n\nQUERY:\n{query}"
    else:
        prompt_text = query

    # Create the event queue and streaming runner
    event_q: queue.Queue = queue.Queue()
    settings = Settings()
    runner = StreamingRLMRunner(event_queue=event_q, settings=settings)

    # Run the RLM loop in a background thread
    def _run():
        try:
            runner.run(prompt_text)
        except Exception as exc:
            traceback.print_exc()
            event_q.put({
                "event": "error",
                "data": {"message": str(exc)},
            })
        finally:
            event_q.put(None)  # Sentinel to end the stream

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()

    # SSE generator
    def _event_stream():
        while True:
            item = event_q.get()
            if item is None:
                break
            event_type = item["event"]
            data_json = json.dumps(item["data"], ensure_ascii=False)
            yield f"event: {event_type}\ndata: {data_json}\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
