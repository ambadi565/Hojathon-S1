"""Unit tests for ``rlm.client.LLMClient``.

Verifies that system, user, and assistant messages are correctly formatted
and passed to the ``google-genai`` SDK client.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from rlm.client import LLMClient
from rlm.config import Settings


@pytest.fixture()
def settings() -> Settings:
    return Settings(
        ROOT_MODEL="gemini-2.5-pro",
        WORKER_MODEL="gemini-2.5-flash",
        GEMINI_API_KEY="test-gemini-key",
    )


def test_llm_client_init(settings: Settings) -> None:
    with patch("rlm.client.genai.Client") as mock_genai_client:
        client = LLMClient(settings=settings)
        mock_genai_client.assert_called_once_with(api_key="test-gemini-key")


def test_call_root(settings: Settings) -> None:
    mock_genai_client_inst = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "Root model response"
    mock_genai_client_inst.models.generate_content.return_value = mock_response

    with patch("rlm.client.genai.Client", return_value=mock_genai_client_inst):
        llm_client = LLMClient(settings=settings)
        messages = [
            {"role": "system", "content": "You are an assistant."},
            {"role": "user", "content": "Hello!"},
            {"role": "assistant", "content": "Hi there!"},
            {"role": "user", "content": "How are you?"},
        ]
        result = llm_client.call_root(messages)

        assert result == "Root model response"
        mock_genai_client_inst.models.generate_content.assert_called_once()
        call_kwargs = mock_genai_client_inst.models.generate_content.call_args.kwargs
        assert call_kwargs["model"] == "gemini-2.5-pro"
        assert len(call_kwargs["contents"]) == 3
        assert call_kwargs["config"].system_instruction == "You are an assistant."


def test_call_worker(settings: Settings) -> None:
    mock_genai_client_inst = MagicMock()
    mock_response = MagicMock()
    mock_response.text = "Worker model response"
    mock_genai_client_inst.models.generate_content.return_value = mock_response

    with patch("rlm.client.genai.Client", return_value=mock_genai_client_inst):
        llm_client = LLMClient(settings=settings)
        result = llm_client.call_worker("Summarize this context.")

        assert result == "Worker model response"
        mock_genai_client_inst.models.generate_content.assert_called_once_with(
            model="gemini-2.5-flash",
            contents="Summarize this context.",
        )
