"""Recursive Language Model (RLM) Harness.

A standalone Python implementation of a Recursive Language Model inference engine
based on arXiv:2512.24601. The engine treats arbitrarily long user prompts as
external state stored inside a persistent REPL environment rather than feeding
them directly into the root LLM's context window.
"""

from rlm.config import Settings
from rlm.repl import PersistentREPL
from rlm.agent import RLMRunner

__all__ = ["Settings", "PersistentREPL", "RLMRunner"]
