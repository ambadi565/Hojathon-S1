"""OpenAI API client wrapper for the RLM harness.

Provides separate methods for the root orchestrator model and the
sub-call worker model, using the official ``openai`` Python SDK.
"""

from __future__ import annotations

import openai

from rlm.config import Settings


class LLMClient:
    """Thin wrapper around the OpenAI chat-completions API.

    Args:
        settings: Configuration settings providing model IDs and the API key.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings()
        self._client = openai.OpenAI(api_key=self.settings.OPENAI_API_KEY)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def call_root(self, messages: list[dict]) -> str:
        """Call the root orchestrator model synchronously.

        Args:
            messages: Full conversation history (system + user + assistant turns).

        Returns:
            The assistant's response text.
        """
        response = self._client.chat.completions.create(
            model=self.settings.ROOT_MODEL,
            messages=messages,
        )
        return response.choices[0].message.content or ""

    def call_worker(self, prompt: str) -> str:
        """Call the worker model synchronously with a single user prompt.

        Args:
            prompt: The prompt to send to the worker model.

        Returns:
            The worker model's response text.
        """
        response = self._client.chat.completions.create(
            model=self.settings.WORKER_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or ""
