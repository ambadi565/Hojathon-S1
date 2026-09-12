"""Integration tests for ``rlm.agent.RLMRunner``.

All tests use mocked root and worker calls — no API key required.

Verifies:
- ``FINAL(text)`` returns direct text.
- ``FINAL_VAR(variable_name)`` returns the REPL variable value.
- Multiline termination content is parsed correctly.
- REPL code is extracted and executed.
- Environment observations are fed back into root history.
- A no-action root response receives a follow-up nudge.
- The loop stops at ``MAX_ITERATIONS`` when no termination tag is produced.
"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from rlm.agent import RLMRunner, _extract_code_blocks, _parse_final, _parse_final_var
from rlm.config import Settings


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------

@pytest.fixture()
def settings() -> Settings:
    """Return test settings with a low iteration cap."""
    return Settings(
        MAX_ITERATIONS=5,
        OPENAI_API_KEY="test-key",
        STDOUT_TRUNCATION_LIMIT=2000,
        PREVIEW_LIMIT=500,
    )


# ------------------------------------------------------------------
# Parsing unit tests
# ------------------------------------------------------------------

class TestParsing:
    """Tests for the internal parsing helpers."""

    def test_parse_final_simple(self) -> None:
        assert _parse_final("FINAL(42)") == "42"

    def test_parse_final_with_surrounding_text(self) -> None:
        text = "After analysis, FINAL(The answer is 42) — done."
        assert _parse_final(text) == "The answer is 42"

    def test_parse_final_multiline(self) -> None:
        text = "FINAL(Line one\nLine two\nLine three)"
        result = _parse_final(text)
        assert result is not None
        assert "Line one" in result
        assert "Line three" in result

    def test_parse_final_returns_none_when_absent(self) -> None:
        assert _parse_final("No termination here") is None

    def test_parse_final_var(self) -> None:
        assert _parse_final_var("FINAL_VAR(summary)") == "summary"

    def test_parse_final_var_returns_none_when_absent(self) -> None:
        assert _parse_final_var("Nothing here") is None

    def test_extract_repl_blocks(self) -> None:
        text = "Some text\n```repl\nprint('hi')\n```\nMore text"
        assert _extract_code_blocks(text) == "print('hi')"

    def test_extract_python_fallback(self) -> None:
        text = "Some text\n```python\nprint('hi')\n```\nMore text"
        assert _extract_code_blocks(text) == "print('hi')"

    def test_extract_multiple_blocks(self) -> None:
        text = "```repl\na = 1\n```\ntext\n```repl\nb = 2\n```"
        code = _extract_code_blocks(text)
        assert "a = 1" in code
        assert "b = 2" in code

    def test_repl_preferred_over_python(self) -> None:
        text = "```repl\nrepl_code()\n```\n```python\npython_code()\n```"
        code = _extract_code_blocks(text)
        assert "repl_code()" in code
        # python block should NOT be included when repl blocks exist
        assert "python_code()" not in code


# ------------------------------------------------------------------
# Runner integration tests
# ------------------------------------------------------------------

class TestRunnerFinal:
    """Tests for FINAL() termination."""

    def test_final_direct_text(self, settings: Settings) -> None:
        """Root responds with FINAL(text) on the first turn."""
        mock_client = MagicMock()
        mock_client.call_root.return_value = "FINAL(The answer is 42)"
        mock_client.call_worker.return_value = ""

        runner = RLMRunner(settings=settings, llm_client=mock_client)
        result = runner.run("test prompt")

        assert result.terminated
        assert result.answer == "The answer is 42"
        assert len(result.trajectory) == 1

    def test_final_multiline(self, settings: Settings) -> None:
        """Root responds with a multiline FINAL()."""
        mock_client = MagicMock()
        mock_client.call_root.return_value = "FINAL(Line 1\nLine 2\nLine 3)"
        mock_client.call_worker.return_value = ""

        runner = RLMRunner(settings=settings, llm_client=mock_client)
        result = runner.run("test prompt")

        assert result.terminated
        assert "Line 1" in result.answer
        assert "Line 3" in result.answer


class TestRunnerFinalVar:
    """Tests for FINAL_VAR() termination."""

    def test_final_var_returns_value(self, settings: Settings) -> None:
        """Root first creates a variable, then terminates with FINAL_VAR."""
        call_count = 0

        def mock_call_root(messages):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return "```repl\nresult = 'computed value'\n```"
            return "FINAL_VAR(result)"

        mock_client = MagicMock()
        mock_client.call_root.side_effect = mock_call_root
        mock_client.call_worker.return_value = ""

        runner = RLMRunner(settings=settings, llm_client=mock_client)
        result = runner.run("test prompt")

        assert result.terminated
        assert result.answer == "computed value"

    def test_final_var_missing_variable(self, settings: Settings) -> None:
        """FINAL_VAR referencing a non-existent variable returns a descriptive message."""
        mock_client = MagicMock()
        mock_client.call_root.return_value = "FINAL_VAR(nonexistent)"
        mock_client.call_worker.return_value = ""

        runner = RLMRunner(settings=settings, llm_client=mock_client)
        result = runner.run("test prompt")

        assert result.terminated
        assert "not found" in result.answer


class TestRunnerCodeExecution:
    """Tests for REPL code extraction and execution."""

    def test_code_is_extracted_and_executed(self, settings: Settings) -> None:
        """Code in a ```repl block should be executed in the REPL."""
        call_count = 0

        def mock_call_root(messages):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return "```repl\nx = 42\nprint(x)\n```"
            return "FINAL(done)"

        mock_client = MagicMock()
        mock_client.call_root.side_effect = mock_call_root
        mock_client.call_worker.return_value = ""

        runner = RLMRunner(settings=settings, llm_client=mock_client)
        result = runner.run("test prompt")

        assert result.terminated
        # First step should have executed code
        assert result.trajectory[0].code_executed is not None
        assert "42" in (result.trajectory[0].repl_output or "")

    def test_observation_fed_back_to_history(self, settings: Settings) -> None:
        """After execution, the stdout should appear in the root model's history."""
        call_count = 0

        def mock_call_root(messages):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return "```repl\nprint('observed output')\n```"
            # On the second call, the observation should be in the messages
            # Verify it's there by checking the last user message
            last_user = [m for m in messages if m["role"] == "user"][-1]
            assert "observed output" in last_user["content"]
            return "FINAL(verified)"

        mock_client = MagicMock()
        mock_client.call_root.side_effect = mock_call_root
        mock_client.call_worker.return_value = ""

        runner = RLMRunner(settings=settings, llm_client=mock_client)
        result = runner.run("test prompt")

        assert result.terminated
        assert result.answer == "verified"


class TestRunnerNudge:
    """Tests for the nudge behaviour when the root produces no code or tags."""

    def test_no_action_receives_nudge(self, settings: Settings) -> None:
        """When the root produces neither code nor termination, a nudge is sent."""
        call_count = 0

        def mock_call_root(messages):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return "Hmm, let me think about this..."
            # Second call: verify nudge was appended
            last_user = [m for m in messages if m["role"] == "user"][-1]
            assert "neither executable code nor a termination tag" in last_user["content"]
            return "FINAL(ok)"

        mock_client = MagicMock()
        mock_client.call_root.side_effect = mock_call_root
        mock_client.call_worker.return_value = ""

        runner = RLMRunner(settings=settings, llm_client=mock_client)
        result = runner.run("test prompt")

        assert result.terminated
        assert result.answer == "ok"


class TestRunnerMaxIterations:
    """Tests for the MAX_ITERATIONS safety cap."""

    def test_max_iterations_reached(self, settings: Settings) -> None:
        """The loop should stop after MAX_ITERATIONS even without termination."""
        mock_client = MagicMock()
        # Always return a no-action response
        mock_client.call_root.return_value = "Still thinking..."
        mock_client.call_worker.return_value = ""

        runner = RLMRunner(settings=settings, llm_client=mock_client)
        result = runner.run("test prompt")

        assert not result.terminated
        assert len(result.trajectory) == settings.MAX_ITERATIONS
        assert "MAX_ITERATIONS" in result.answer


class TestRunnerSubCalls:
    """Tests for sub-call tracking."""

    def test_sub_calls_counted(self, settings: Settings) -> None:
        """Worker calls made via llm_query should be counted in the trajectory."""
        call_count = 0

        def mock_call_root(messages):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return (
                    "```repl\n"
                    "results = [llm_query(f'q{i}') for i in range(3)]\n"
                    "print(results)\n"
                    "```"
                )
            return "FINAL(done)"

        mock_client = MagicMock()
        mock_client.call_root.side_effect = mock_call_root
        mock_client.call_worker.return_value = "worker response"

        runner = RLMRunner(settings=settings, llm_client=mock_client)
        result = runner.run("test prompt")

        assert result.terminated
        assert result.total_sub_calls == 3
        assert result.trajectory[0].sub_call_count == 3
