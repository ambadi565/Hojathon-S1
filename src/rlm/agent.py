"""RLM orchestration loop — Algorithm 1.

Implements the main recursive loop where the root model generates code,
the REPL executes it, and observations are fed back until a termination
tag is produced.
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from typing import Optional

from rlm.client import LLMClient
from rlm.config import Settings
from rlm.prompts import build_system_prompt
from rlm.repl import PersistentREPL


# ------------------------------------------------------------------
# Trajectory tracking
# ------------------------------------------------------------------

@dataclass
class TrajectoryStep:
    """One turn of the RLM loop.

    Attributes:
        iteration: 1-based iteration number.
        assistant_text: Raw text returned by the root model.
        code_executed: Python code that was extracted and run, or ``None``.
        repl_output: Captured stdout / traceback from REPL execution, or ``None``.
        sub_call_count: Number of ``llm_query`` sub-calls made during this step.
    """

    iteration: int
    assistant_text: str
    code_executed: Optional[str] = None
    repl_output: Optional[str] = None
    sub_call_count: int = 0


@dataclass
class RunResult:
    """Result of a complete RLM run.

    Attributes:
        answer: The final answer string.
        trajectory: List of trajectory steps for diagnostics.
        total_sub_calls: Cumulative sub-call count across all steps.
        terminated: Whether the run ended via a FINAL / FINAL_VAR tag
                    (``False`` when it hit MAX_ITERATIONS).
    """

    answer: str
    trajectory: list[TrajectoryStep] = field(default_factory=list)
    total_sub_calls: int = 0
    terminated: bool = False


# ------------------------------------------------------------------
# Parsing helpers
# ------------------------------------------------------------------

# Match FINAL(...) — the content may span multiple lines.
_FINAL_RE = re.compile(r"FINAL\((.*)\)", re.DOTALL)
# Match FINAL_VAR(variable_name) — single token, no whitespace.
_FINAL_VAR_RE = re.compile(r"FINAL_VAR\((\w+)\)")

# Match ```repl ... ``` code blocks (primary), and ```python ... ``` (fallback).
_REPL_BLOCK_RE = re.compile(r"```repl\s*\n(.*?)```", re.DOTALL)
_PYTHON_BLOCK_RE = re.compile(r"```python\s*\n(.*?)```", re.DOTALL)


def _parse_final(text: str) -> Optional[str]:
    """Extract direct answer from ``FINAL(...)``."""
    m = _FINAL_RE.search(text)
    if m:
        return m.group(1).strip()
    return None


def _parse_final_var(text: str) -> Optional[str]:
    """Extract variable name from ``FINAL_VAR(...)``."""
    m = _FINAL_VAR_RE.search(text)
    if m:
        return m.group(1).strip()
    return None


def _extract_code_blocks(text: str) -> str:
    """Extract code from ```repl blocks (primary) or ```python blocks (fallback).

    Multiple blocks are concatenated with newlines.
    """
    blocks = _REPL_BLOCK_RE.findall(text)
    if not blocks:
        blocks = _PYTHON_BLOCK_RE.findall(text)
    return "\n".join(blocks).strip()


# ------------------------------------------------------------------
# Runner
# ------------------------------------------------------------------

class RLMRunner:
    """Main RLM orchestration runner (Algorithm 1).

    Args:
        settings: Configuration settings.
        llm_client: Pre-built LLM client. If ``None``, one is created from *settings*.
        repl: Pre-built REPL instance. If ``None``, one is created from *settings*.
    """

    def __init__(
        self,
        settings: Settings | None = None,
        llm_client: LLMClient | None = None,
        repl: PersistentREPL | None = None,
    ) -> None:
        self.settings = settings or Settings()
        self.client = llm_client or LLMClient(self.settings)
        self.repl = repl or PersistentREPL(self.settings)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(self, prompt_text: str) -> RunResult:
        """Execute the RLM loop for *prompt_text*.

        Args:
            prompt_text: The full user document / prompt.

        Returns:
            A :class:`RunResult` containing the answer and trajectory.
        """
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

                # 3.5 — Append observation
                status = "✅ Execution succeeded" if success else "❌ Execution failed"
                observation = f"[REPL observation — {status}]\n{output}"
                history.append({"role": "user", "content": observation})
            else:
                # 3.6 — No code and no termination: nudge the model
                step.sub_call_count = sub_call_counter["count"]
                total_sub_calls += step.sub_call_count
                trajectory.append(step)

                nudge = (
                    "Your last response contained neither executable code nor a "
                    "termination tag. Please either:\n"
                    "1. Write Python code inside a ```repl block to continue analysis, or\n"
                    "2. Provide your final answer using FINAL(your answer) or FINAL_VAR(variable_name)."
                )
                history.append({"role": "user", "content": nudge})

        # --- Step 4: MAX_ITERATIONS reached ---
        return RunResult(
            answer="[RLM loop reached MAX_ITERATIONS without a final answer]",
            trajectory=trajectory,
            total_sub_calls=total_sub_calls,
            terminated=False,
        )
