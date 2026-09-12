"""Google AI Studio Gemini API client wrapper for the RLM harness.

Provides separate methods for the root orchestrator model and the
sub-call worker model, using the official ``google-genai`` Python SDK.
"""

from __future__ import annotations

import time
# pyrefly: ignore [missing-import]
from google import genai
# pyrefly: ignore [missing-import]
from google.genai import errors, types

from rlm.config import Settings


class LLMClient:
    """Thin wrapper around the Google AI Studio Gemini API.

    Args:
        settings: Configuration settings providing model IDs and the API key.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings()
        api_key = self.settings.GEMINI_API_KEY or None
        self._client = genai.Client(api_key=api_key) if api_key else genai.Client()

    def _call_with_retry(self, func, *args, **kwargs):
        max_retries = 6
        base_delay = 12.0
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except (errors.APIError, Exception) as err:
                err_str = str(err)
                code = getattr(err, "code", None)
                is_rate_limited = code == 429 or "429" in err_str or "RESOURCE_EXHAUSTED" in err_str
                is_daily_quota = "PerDay" in err_str or "daily quota" in err_str.lower()
                if is_daily_quota:
                    raise RuntimeError(
                        "Gemini API daily quota exhausted for the configured model. "
                        "Use a key with available quota or wait for the quota to reset."
                    ) from err
                if is_rate_limited and attempt < max_retries - 1:
                    wait_time = base_delay * (1.5 ** attempt)
                    print(
                        f"\n[Rate Limit 429] Gemini Free Tier limit reached. Waiting {wait_time:.1f}s before retry (attempt {attempt + 1}/{max_retries})...",
                        flush=True,
                    )
                    time.sleep(wait_time)
                else:
                    raise

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
        system_parts: list[str] = []
        contents: list[types.Content] = []

        for msg in messages:
            role = msg.get("role")
            content = msg.get("content", "")
            if role == "system":
                system_parts.append(content)
            elif role == "user":
                contents.append(
                    types.Content(
                        role="user",
                        parts=[types.Part.from_text(text=content)],
                    )
                )
            elif role in ("assistant", "model"):
                contents.append(
                    types.Content(
                        role="model",
                        parts=[types.Part.from_text(text=content)],
                    )
                )

        config = None
        if system_parts:
            config = types.GenerateContentConfig(
                system_instruction="\n\n".join(system_parts)
            )

        response = self._call_with_retry(
            self._client.models.generate_content,
            model=self.settings.ROOT_MODEL,
            contents=contents if contents else None,
            config=config,
        )
        return response.text or ""

    def call_worker(self, prompt: str) -> str:
        """Call the worker model synchronously with a single user prompt.

        Args:
            prompt: The prompt to send to the worker model.

        Returns:
            The worker model's response text.
        """
        response = self._call_with_retry(
            self._client.models.generate_content,
            model=self.settings.WORKER_MODEL,
            contents=prompt,
        )
        return response.text or ""
