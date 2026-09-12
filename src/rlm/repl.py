"""Persistent REPL environment for the RLM harness.

Provides a sandboxed Python execution environment with persistent state,
stdout capture, output truncation, and injected helper callables.
"""

from __future__ import annotations

import collections
import contextlib
import io
import json
import math
import re
import sys
import traceback
from typing import Callable, Optional

from rlm.config import Settings


class PersistentREPL:
    """A persistent Python REPL that maintains state across executions.

    The REPL pre-populates its namespace with safe standard-library modules
    and supports injecting a ``llm_query`` callable and an external ``context``
    variable for use by generated code.

    Args:
        settings: Configuration settings controlling truncation limits.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings()
        self.env_globals: dict = {
            "__builtins__": __builtins__,
            "re": re,
            "math": math,
            "json": json,
            "collections": collections,
        }

    # ------------------------------------------------------------------
    # Context & helper injection
    # ------------------------------------------------------------------

    def set_context(self, context_str: str) -> None:
        """Store the full input text as ``context`` in the REPL namespace.

        Args:
            context_str: The complete user-supplied document / prompt text.
        """
        self.env_globals["context"] = context_str

    def inject_llm_query(self, fn: Callable[[str], str]) -> None:
        """Inject a callable ``llm_query(prompt) -> str`` into the REPL namespace.

        Args:
            fn: A function that accepts a prompt string and returns an LLM response.
        """
        self.env_globals["llm_query"] = fn

    # ------------------------------------------------------------------
    # Execution
    # ------------------------------------------------------------------

    def execute(self, code: str) -> tuple[str, bool, Optional[Exception]]:
        """Execute *code* inside the persistent namespace.

        Captures ``sys.stdout``, applies truncation, and catches exceptions
        without crashing the host process.

        Args:
            code: Python source code to execute.

        Returns:
            A 3-tuple ``(output, success, exception)``:
            - *output*: Captured stdout (possibly truncated) or a traceback string.
            - *success*: ``True`` when execution completed without error.
            - *exception*: The caught exception object, or ``None`` on success.
        """
        stdout_capture = io.StringIO()
        limit = self.settings.STDOUT_TRUNCATION_LIMIT

        try:
            with contextlib.redirect_stdout(stdout_capture):
                exec(code, self.env_globals)  # noqa: S102 – intentional exec
            output = stdout_capture.getvalue()
            if len(output) > limit:
                output = output[:limit] + "\n[Truncated: output exceeded limit]"
            return output, True, None

        except SyntaxError:
            tb = traceback.format_exc()
            return tb, False, sys.exc_info()[1]

        except Exception as exc:  # noqa: BLE001
            # Append any partial stdout that was written before the error.
            partial = stdout_capture.getvalue()
            tb = traceback.format_exc()
            output = (partial + "\n" + tb).strip()
            if len(output) > limit:
                output = output[:limit] + "\n[Truncated: output exceeded limit]"
            return output, False, exc
